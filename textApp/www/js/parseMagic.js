window.magic = (function ($, document, window, Parse) {
    "use strict";

    var magic = {};

    //  Setup parse
    var parseAppId = "bGwXAzYa23yIkCfbpHMM6j2CD9iBfvJ1YBdVt9V5";
    var parseJavascriptId = "DrmyAyt0zDPOlcraBEGBs6wcgOJvQtfCf3DC67OW";
    Parse.initialize(parseAppId, parseJavascriptId);

    magic.isset = function (check) {
        var test = (typeof check !== 'undefined' && check !== null && check !== "");
        if (check instanceof Array) {
            test = test && (check.length > 0);
        }
        return test;
    };

    //  Verify login with parse
    magic.parseLogin = function (myNumber, myName, myContacts) {
        var UserTable = Parse.Object.extend("Users");
        var query = new Parse.Query(UserTable);
        var newUser = new UserTable();
        query.equalTo("number", "4124250019");
        return query.find().then(function (Table) {
            if (!magic.isset(Table)) {
                newUser.set("number", myNumber);
                newUser.set("name", myName);
                newUser.set("contacts", myContacts);
                newUser.set("groups", []);

                return newUser.save()
                    .then(function(){
                        return true;
                    });
            }
            else {
                return true;
            }
        });

        // return result;
    };

    /*
     *  Get my groups
     *  Returns: Array( Array(groupName, groupId) , ... )
     */
    magic.getMyGroups = function (myNumber) {
        
        var UserTable = Parse.Object.extend("Users");
        var query = new Parse.Query(UserTable);

        
        query .equalTo("number", myNumber);

        return query.find().then(function (Table){
            if(magic.isset(Table)){
                var table = Table[0];
                return Table[0].toJSON().groups;
            }
            else
                return [];
        });
    };


    /*
     *  Get all of my friends who use the app
     *  Takes in:   List of all the numbers in my contact list
     *  Returns:    List of my friends numbers who use the app - Array( number1, number2, ...)
     */
    magic.getMyFriends = function (myNumber) {
        var UserTable = Parse.Object.extend("Users");
        var query = new Parse.Query(UserTable);

        query.equalTo("number", myNumber);  //   Find myself

        return query.find().then(function (Table) {
            var temp = Table[0].toJSON();

            var listOfMyFriendsNumbers = Table[0].toJSON().contacts; 
            if(listOfMyFriendsNumbers === 'undefined') {
                return [];
            }
            var promises = [];
            for(var i = 0; i < listOfMyFriendsNumbers.length; i++) {    //  Go through all of my contacts
                query.equalTo("number", listOfMyFriendsNumbers[i]);
                promises.push(
                    query.find()
                );
            }
            return Parse.Promise.when(promises)
                .then(function (Table) {   
                    var finalList = [];  
                    if(!magic.isset(Table)) {
                        return finalList;
                    }   
                    var field = Table[0].toJSON();   
                    if(magic.isset(field)) {
                        finalList.push(field.contacts);
                    }
                    return finalList;
                });
        });
    };

    magic.addGroupToUser = function(groupId, number) {
        var UserTable = Parse.Object.extend("Users");
        var query = new Parse.Query(UserTable);

        query.equalTo("number", number);

        query.first().then(function (Row) {            //  Found user to add group id to
            if(!magic.isset(Row)) {
                return;
            }
            var groupIds = Row.toJSON().groups;    //  users current group ids he belongs to
            var exists = $.inArray(groupId, groupIds);
            if(exists === -1) {     //  Add to group
                groupIds.push(groupId);
            }
            Row.set("groups", groupIds);
            Row.save();
        });
    };
    /*
     *  Binds together the group name, owners number,
     *      list of friends ids in the group, targets number,
     *      and the owners twilio number for this group
     *  Returns:    The group Id for this group
     */
    magic.bindGroup = function (groupName, myNumber, groupNumbers, targetNumber) {
        var groupId = groupName + myNumber;
        var twilioNumber = magic.getATwilioNumber();
        var GroupTable = Parse.Object.extend("Groups");
        var query = new Parse.Query(GroupTable);
        var newGroup = new GroupTable();
        groupNumbers = magic.isset(groupNumbers) ? groupNumbers : [];
        query.equalTo("groupId", groupId);
        return query.find().then(function (Table) {
            if (!magic.isset(Table)) {
                newGroup.set("groupId", groupName + myNumber);
                newGroup.set("number", myNumber);
                newGroup.set("name", groupName);
                newGroup.set("target", targetNumber);
                newGroup.set("members", []);
                newGroup.set("genChat", []);
                newGroup.set("targetChat", []);
                return newGroup.save()
                    .then(function(){
                        for (var i = 0; i < groupNumbers.length; i++) {
                            magic.addGroupToUser(groupId, groupNumbers[i]);
                        }
                        magic.addGroupToUser(groupId, myNumber);
                        return groupId;
                    });
            }
            else {
                return groupId;
            }
        });    
        
    };

    /*
     *  Creates or gets a new twilio number
     *  Returns the twilio number to use
     */
    magic.getATwilioNumber = function () {

    };

    /*
     *  Sends a message to the group or target
     *  If target: Use the twilio number to message target, then send message to group
     *  If group: Only send message to the group
     *
     *  string sendType: "group"/"target"
     *  Return: true/false on success
     */

     magic.sendMessageToGroup = function(fromNumber, message, groupId){
        var GroupTable = Parse.Object.extend("Groups");
        var query = new Parse.Query(GroupTable);

        query.equalTo("groupId", groupId);

        query.first().then(function (Row) {            //  Found group to add message to
            if(!magic.isset(Row)) {
                return;
            }
            var messages = Row.toJSON().genChat;    //  users current group ids he belongs to
            var currentMessage = fromNumber + ": " + message;
            messages.push(currentMessage);
            
            Row.set("genChat", messages);
            Row.save();
        });
     };

    magic.sendMessageToTarget = function(fromNumber, message, groupId){
        var GroupTable = Parse.Object.extend("Groups");
        var query = new Parse.Query(GroupTable);

        query.equalTo("groupId", groupId);

        query.first().then(function (Row) {            //  Found group to add message to
            if(!magic.isset(Row)) {
                return;
            }
            var messages = Row.toJSON().targetChat;    //  users current group ids he belongs to
            var ownerNumber = Row.toJSON().number; 
            if(ownerNumber !== fromNumber) { //  check to see if from number is the owner of the group
                return; //  Not the owner, not allowed to post to target
            }

            var currentMessage = fromNumber + ": " + message;
            messages.push(currentMessage);
            
            Row.set("targetChat", messages);

            Row.save();

            var targetNumber = Row.toJSON().target;
            Parse.Cloud.run('sendMessage', { number: targetNumber, body: message }, {
              success: function(resp) {
                // do stuff with response
              },
              error: function(resp) {
              }
            });
            
        });
     };

    magic.sendMessageTo = function (sendType, fromNumber, message, groupId) {
        if (sendType === 'target') {
            //  Send message to target
            //  Code here

            //  then send message to group...
            magic.sendMessageToTarget(fromNumber, message, groupId);
            return true;
        } 
        else {
            //  Send message to group 
            //  Code here
            magic.sendMessageToGroup(fromNumber, message, groupId);
            return true;
        }
        return false;
    };

    magic.getGroupMessages = function(groupId) {
        var GroupTable = Parse.Object.extend("Groups");
        var query = new Parse.Query(GroupTable);

        query.equalTo("groupId", groupId);          //  Found my group    

        return query.first().then(function (Row) {          //  Return User groups messages promise
            if(!magic.isset(Row)) {
                return;
            }
            var messages = Row.toJSON().genChat;    //  Messages for that group
            return messages;
        });

    };

    magic.getTargetMessages = function(groupId) {
        var GroupTable = Parse.Object.extend("Groups");
        var query = new Parse.Query(GroupTable);

        query.equalTo("groupId", groupId);          //  Found my group    

        return query.first().then(function (Row) {          //  Return User groups messages promise
            if(!magic.isset(Row)) {
                return;
            }
            var messages = Row.toJSON().targetChat;    //  Messages for that group
            return messages;
        });

    };

    return magic;

}(window.$, document, window, window.Parse));
