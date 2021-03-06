define([],function(){
    var util = {};
    util.uuid = function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
    util.getDomFromHtml = function(htmlString){
        var wrapper = document.createElement('div')
        wrapper.innerHTML = htmlString
        return wrapper.firstChild
    }
    return util;
});