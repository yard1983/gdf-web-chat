var me = {};
me.avatar = "http://virtualproductions.co.za/wp-content/uploads/2018/04/user_image.jpg";

var bot = {};
bot.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmYPWnjPHbtWJ7ii5zqc3Xf9K1vx8K3jbnP_VtGNE2N5LyFiWHTQ&s";

// ininadoptioninternal
var chatConfig = {
				  "organizationId": "469e5298-2ec4-4340-bdea-08ad8c2495b5",
				  "deploymentId": "332e107c-65a2-4a05-8c7c-70a75bea3889",
				  "routingTarget": {
					"targetType": "QUEUE",
					"targetAddress": "LatamTest"
				  },
				  "memberInfo": {
					"displayName": "Customer",
					"profileImageUrl": me.avatar,
					"customFields": {
					  "firstName": "Customer",
					  "lastName": ""
					  }
					}
				  };


const PARTICIPANT_TYPE = { BOT: "Bot", AGENT: "Agente"}				  
var token = "";
var conversationId = "";
var agentMemberId = "";
var customerMemberId = "";
var currentParticipant = PARTICIPANT_TYPE.BOT;
var chatbotHistory = "";
var displayName = "Customer";
var botName = "Bot";
var chatbotHistorySent = false;
var surveyURI = "";



function formatAMPM(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;
    return strTime;
}            

//-- No use time. It is a javaScript effect.
function insertChat(who, text, time){
    if (time === undefined){
        time = 0;
    }
    var control = "";
    var date = formatAMPM(new Date());
    
    if (who == "me"){
		
        control = '<li style="width:100%">' +
                        '<div class="msj macro">' +
                        '<div class="avatar"><img class="img-circle" style="width:100%;" src="'+ me.avatar +'" /></div>' +
                            '<div class="text text-l">' +
                                '<p>'+ text +'</p>' +
                                '<p><small>'+date+'</small></p>' +
                            '</div>' +
                        '</div>' +
                    '</li>'; 
		 					
					
					
		if(currentParticipant == PARTICIPANT_TYPE.BOT)
			chatbotHistory += displayName + ": " + text + "\n";
    }else{
		
        control = '<li style="width:100%;">' +
                        '<div class="msj-rta macro">' +
                            '<div class="text text-r">' +
                                '<p>'+text+'</p>' +
                                '<p><small>'+date+'</small></p>' +
                            '</div>' +
                        '<div class="avatar" style="padding:0px 0px 0px 10px !important"><img class="img-circle" style="width:100%;" src="'+bot.avatar+'" /></div>' +                                
                  '</li>';
						
				  
		if(currentParticipant == PARTICIPANT_TYPE.BOT)
			chatbotHistory += botName + ": " + text + "\n";
    }
    setTimeout(
        function(){  
			$("#chatTranscript").append(control).scrollTop($("#chatTranscript").prop('scrollHeight'));
        }, time);
    
}

function resetChat(){    
	$("#chatTranscript").empty();

}

function disableChat(){
	printMessage("Chat finalizado");
	
	$("#mytext").prop('disabled', true);
	$("#endChat").prop('disabled', true);
							
}

function createChatPurecloud(){
	let url = "https://api.mypurecloud.com/api/v2/webchat/guest/conversations";
  
    $.ajax({
			type: "POST",	
			url: url,
			data: JSON.stringify(chatConfig),
			contentType: "application/json",
			dataType: 'json',
			success: function(result){				
				console.log(result);
				
				token = result.jwt;
				conversationId = result.id;	
							
				let webSocket = new WebSocket(result.eventStreamUri);
				
				webSocket.onopen = function(e) {
				  console.log("Connection established");
				  printMessage("Conectando con agente...");
				  $("#mytext").prop('readonly', true);				  
				};

				webSocket.onmessage = function(event) {
					console.log(event.data, "event.data");					
					
					let message = JSON.parse(event.data);
					console.log(message, "message");
					
					if(message && message.eventBody)
					{						
						if(message.eventBody.bodyType == "standard" && message.eventBody.sender && message.eventBody.sender.id == agentMemberId)
							insertChat("bot", message.eventBody.body, 0);  
						else if(message.eventBody.bodyType == "member-join")
							getConversationMembers();
						
						
						if(message.eventBody.member && ((message.eventBody.member.id == agentMemberId && message.eventBody.member.state == "DISCONNECTED") || (message.eventBody.member.id == customerMemberId && message.eventBody.member.state == "DISCONNECTED")))
						{
							//Agent or customer disconnected
							webSocket.close();		
							disableChat();
							if(surveyURI)
							{		
								window.location.href = $(location).attr('origin') + "/" + surveyURI;
							}							
						}
					}						
				  
				};
								
			}
		});  
}

function printMessage(text)
{
	let control = '<span>' + text + '<br></span>'; 	
						
	$("#chatTranscript").append(control).scrollTop($("#chatTranscript").prop('scrollHeight'));
	
}
function getConversationMembers(){
	let url = "https://api.mypurecloud.com/api/v2/webchat/guest/conversations/" + conversationId + "/members";
	  
    $.ajax({
			type: "GET",	
			url: url,			
			contentType: "application/json",
			dataType: 'json',
			headers: {'Authorization': 'Bearer ' + token},
			success: function(result){				
				console.log(result, "members");
				
				if(result.entities)
				{
					$.each( result.entities, function( i, entity ){
						if(entity.role == "CUSTOMER")
						{
							customerMemberId = entity.id;
							if(!chatbotHistorySent)
							{
								sendMessageToPurecloud("--- bot history ---" + "\n" + chatbotHistory + "--- bot history ---" + "\n");
								chatbotHistorySent = true;
							}
						}							
						else if(entity.role == "AGENT")
						{	
							agentMemberId = entity.id;
							currentParticipant = PARTICIPANT_TYPE.AGENT;
							$("#mytext").prop('readonly', false);
						}
							
					  
					});
					
				}
				
			}		
			
		});  
}

function endConversation(){
	
	console.log("customerMemberId: " + customerMemberId, "endConversation")
	let url = "https://api.mypurecloud.com/api/v2/webchat/guest/conversations/" + conversationId + "/members/" + customerMemberId;
	  
	if(customerMemberId)
	{
		$.ajax({
				type: "DELETE",	
				url: url,			
				contentType: "application/json",
				dataType: 'json',
				headers: {'Authorization': 'Bearer ' + token},
				success: function(result){				
					console.log(result, "Chat finalizado");						
				}		
				
			});  
	}
}

function sendMessageToBot(text, type = "standard"){
	let url = "https://httpbin.org/get?text=";		
			
    $.ajax({
				type: "GET",
				url: url + text,				
				contentType: "application/json",
				dataType: 'json',
				success: function(result){
					console.log(result);
					insertChat("bot", "Simulador bot ->" + result.args.text); 
				
					//Rules to transfer to agent
					if(text && text.toLowerCase().includes("agente"))
					{
						//create purecloud chat
						createChatPurecloud();
						return;
					}
				
				}
			}); 
}

function sendMessageToPurecloud(text, type = "standard"){
	let url = "https://api.mypurecloud.com/api/v2/webchat/guest/conversations/" + conversationId + "/members/" + customerMemberId + "/messages";
	let data =	{
					"body" : text,
					"bodyType" : type
				};
  
    $.ajax({
			type: "POST",	
			url: url,
			data: JSON.stringify(data),
			contentType: "application/json",
			dataType: 'json',
			headers: {'Authorization': 'Bearer ' + token},
			success: function(result){				
				console.log(result, "sendMessagePurecloud");
							
			}
		});  
}

$(document).ready(function(){

$("#sendButton").click(function(e){
	
	var text = $("#mytext").val();
        if (text !== "")
		{
            insertChat("me", text);              
            $("#mytext").val('');
			
			if(currentParticipant == PARTICIPANT_TYPE.AGENT)
				sendMessageToPurecloud(text);
			else if(currentParticipant == PARTICIPANT_TYPE.BOT)
			{				
				sendMessageToBot(text);
			}
			  
  
        }
});	

$("#endChat").click(function(e){
	console.log("currentParticipant: " + currentParticipant, "endChat");
	if(currentParticipant == PARTICIPANT_TYPE.BOT)
	{	
		disableChat();
		return;
	}
	
	endConversation();	
	
});

$("#mytext").keydown(function(e){
    if (e.which == 13){
        var text = $(this).val();
        if (text !== ""){
            insertChat("me", text);              
            $(this).val('');
			
			if(currentParticipant == PARTICIPANT_TYPE.AGENT)
				sendMessageToPurecloud(text);
			else if(currentParticipant == PARTICIPANT_TYPE.BOT)
			{				
				sendMessageToBot(text);
			}
			  
  
        }
    }	
	
});


});

//-- Clear Chat
resetChat();

insertChat("bot", "Hola, soy un asistente virtual, ¿En qué puedo ayudarte?", 0);  
