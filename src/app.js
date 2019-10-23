'use strict';
const dotenv = require('dotenv');
// const request = require("request");
const fetch = require('node-fetch');
const amqp = require('amqplib/callback_api');
//Env Conig
dotenv.config();

const messgaeQueueName= process.env.MESSAGE_QUEUE_NAME || 'main_notification_queue'
const messageQueueURL = process.env.MESSAGE_QUEUE_URL ||  'amqp://localhost'

const emaiQueueName=process.env.EMAIL_QUEUE_NAME || 'main_email_queue'
const emailQueueURL=process.env.EMAIL_QUEUE_URL || 'amqp://localhost'

//Logger Config
// create a custom timestamp format for log statements
const SimpleNodeLogger = require('simple-node-logger'),
    opts = {
        logFilePath:'app.log',
        timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS'
    },
log = SimpleNodeLogger.createSimpleLogger( opts );

/* -------------- Main Enty (Starting Message Queue) ------------------- */

readfromQueueandProcess(messageQueueURL);



/* ************************** Handler function ******************************  */
// Getting Access Token For Machine to Machine Communication , here to communicate with Resource Server DB


async function getAccessToken()
{
   
var options = { method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"client_id":"AQQFPs6alhdlGPXy1hHq66JZA1JqdYuD","client_secret":"tj3hdzE1KIWE6uXBTtLHSrvj1j7OqNWNkC5Qzzr2IFAf5w7wzqJH_aDdCqveidvU","audience":"https://localhost/","grant_type":"client_credentials"}' };


    const response = await fetch('https://rajdeepdev.auth0.com/oauth/token',options);
    const data = await response.json();
    //console.log(data.access_token);

    return data.access_token;

}

async function getAllUsersIdsformUrlId(access_token,url_id)
{
    const authop = {
        headers: { authorization: 'Bearer'+' '+access_token  } 
    }
   
    const response = await fetch('http://localhost/api/uids/'+url_id,authop);
    const data = await response.json();
    return data;
  
       
}

async function finduser(access_token,user_id)
{
    const response = await fetch('http://localhost/users/'+user_id);
    const user = await response.json();
    return user;

}

/* --------------------------------- Main checking & Routing Functions---------------------------------- */

// Write to appropriate notifer queue like SMS / EMAIL /PHONE / API
async function checkandSend(url_id,message)
{
    // STEP 1 get access Token
    var  access_token = await getAccessToken();
    // STEP 2 find user_ids for urlid
    var userIds = await getAllUsersIdsformUrlId(access_token,url_id);
    // STEP 3 get each users for all usersids
    userIds.forEach(myFunction);
   // Call Particular route like email or phone or sms or API
    async function myFunction(value, index, array) {
          var user = await finduser(access_token,value);
        
          /* Some Logic to check if user is subcribed to email or sms or phone or other api communication service
           * after checking route to specific 
           * if email is enabled send to email route and pass the info message
           * if sms is enabled send to sms route and pass the info message
           * if phone is enabled send to call route and pass the info message
           */

           // Email enabled route queue
          var customMessageforEmail= {
              "email":user.email,
              "message":message
          } 
          writeToEmailQueue(emaiQueueName,customMessageforEmail);

    }
    
}

/* Read from Queue */

function readfromQueueandProcess(messageQueueURL)
{
    amqp.connect(messageQueueURL, function(error0, connection) {
        if (error0) {
            throw error0;
        }
        connection.createChannel(function(error1, channel) {
            if (error1) {
                throw error1;
            }
    
            var queue = messgaeQueueName;
    
            channel.assertQueue(queue, {
                durable: false
            });
    
            console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);
    
            channel.consume(queue, function(msg) {
                console.log(" [x] Received %s", msg.content.toString());
                // Read from Message Queue and Done Routing
                var recievedMessage = msg.content.toString();
                var obj = JSON.parse(recievedMessage); 
                // Now Check for courspoind users and send email notofication
                checkandSend(obj.urlId,recievedMessage);
            }, {
                noAck: true
            });
        });
    });
}

/* Write to Email Queue */
function writeToEmailQueue(queueName,message)
{
    amqp.connect(emailQueueURL, function(error0, connection) {
        if (error0) {
          throw error0;
        }
        connection.createChannel(function(error1, channel) {
          if (error1) {
            throw error1;
          }
          var queue = queueName;
          var msg = JSON.stringify(message);
      
          channel.assertQueue(queue, {
            durable: false
          });
      
          channel.sendToQueue(queue, Buffer.from(msg));
          console.log(" [x] Sent %s", msg);
          
        });
      });
}











