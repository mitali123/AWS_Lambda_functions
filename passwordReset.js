const aws = require("aws-sdk");
aws.config.update({ region: "us-east-1" });
var db = new aws.DynamoDB({apiVersion: '2012-08-10'});
var ses = new aws.SES({region: 'us-east-1'});
var ttl = 15*60*1000;
var curr= new Date().getTime();
var expire = (curr + ttl).toString();

//test

exports.passwordReset = function(event, context) {
    var message = event.Records[0].Sns.Message;
    //console.log(‘From SNS:’, message);
    var extracted_message = JSON.parse(message);
    var extracted_message_data = JSON.parse(extracted_message.data);

    console.log("From SNS - message:" + extracted_message.data);
    console.log("From SNS - mail: " + extracted_message_data.email);
    console.log("From SNS - link: " + extracted_message_data.link);

    // http://example.com/reset?email=user@somedomain.com&token=4e163b8b-889a-4ce7-a3f7-61041e323c23
    //extract token from link
    var link = extracted_message_data.link;
    var regex = /(?!.*=)(.*)/;
    var t = link.match(regex);
    var token = t[0].toString();
    console.log("token: " + token);

  //create db params to get and put
  let getParams = {
      TableName: 'csye6225',
      Key: {
        'id': {S: extracted_message_data.email}
      },
    };

    let putParams = {
      TableName: "csye6225",
      Item: {
          id: { S: extracted_message_data.email },
          resetToken: { S: token },
          ttl: { N: expire }
      }
    };
  
  console.log("domain_name:"+process.env.DOMAIN_NAME);
    
    //create email content

    const htmlBody = `
      <!DOCTYPE html>
      <html>
          <head>
          </head>
          <body>
            <p>Hi,</p>
            <p>Your Username is: ${extracted_message_data.email}</p><h>
            <p>Please find the password reset link below:</p>
            ${extracted_message_data.link}
          </body>
      </html>
    `;

    var email = {
        Destination: {
            ToAddresses: [
              extracted_message_data.email
            ]
        },
        Message: {
            Body: {
              Html: {
                  Charset: "UTF-8",
                  Data: htmlBody
                }
              },
            Subject: {
              Charset: "UTF-8",
              Data: process.env.DOMAIN_NAME+": Link to reset your password"
            }
        },
        Source: "Mitali from <CSYE6225@"+process.env.DOMAIN_NAME+">"
    };

    //check db for ttl of item
    db.getItem(getParams, (err, data) => {
      if(!err)
      {
        //if item does not exist put item in db and send email
        if (data.Item == null) {
            db.putItem(putParams, (err, data) => {
              if(!err)
              {
                  console.log(data);
                  //ses send email
                  var sendPromise = ses.sendEmail(email).promise();
                  sendPromise
                  .then(function(data) {
                    console.log("new token.. mail sent");
                      console.log(data.MessageId);
                  })
                  .catch(function(err) {
                      console.error(err, err.stack);
                  });
                }
                else
                {
                  console.log(err);
                }
            });
        } 
        else 
        {
          //if item exists in db, 
          console.log(data.Item);
          let extracted_data = JSON.stringify(data);
          console.log("extracted_data:"+extracted_data);
          let parsed_data = JSON.parse(extracted_data);
          console.log(parsed_data)
          
          //calculate ttl
            let curr_time = new Date().getTime();
            let ttl_time = Number(parsed_data.Item.ttl.N);

            //if curr time is greater than ttl i.e. token expired, insert new 
            if (curr_time > ttl_time) {
              db.putItem(putParams, (err, data) => {
                if(!err)
                {
                    console.log(data);
                    var sendPromise = ses.sendEmail(email).promise();
                    sendPromise
                    .then(function(data) {
                        console.log(data.MessageId);
                    })
                    .catch(function(err) {
                      console.error(err, err.stack);
                    });
                  }
                  else
                  {
                    console.log(err);
                  }
              });
            }
            else
            {
              //token not expired
              //dont send mail
              console.log("token not expired.. mail already sent");
            }
        }
      }
      else
      {
        console.log(err);
      }
    });
};