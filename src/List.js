/**
 * @author 唐品 (Tang Pin)
 * created at 2015-2-13
 */
define([
    './Node',
    './event',
    './util'
],function (Node, EventMgr, Util) {

    var List = function (data, option) {
        this.data = data
        this.index = 0
        this.packages = []

        // container
        if (!option.container) {
            this.frame = document.createElement('div')
            this.frame.classList.add('everything')
        }else{
            this.frame = option.container
        }

        // theme
        this.themes = ['dark', 'light']
        if (option.theme) {
            this.theme = option.theme
        } else {
            this.theme = 'light'
        }
        this.frame.classList.add(this.theme)
        document.body.classList.add(this.theme)

        this.init();
        this.mode = 'insert';
    };


    List.prototype.init = function () {
        var app = this;
        this.eventMgr = new EventMgr();
        this.crumb = new Crumb(this);
        // register event listener
        this.eventMgr.addListener('rootNodeChange', this.onRootNodeChange);
        this.eventMgr.addListener('valueChange', this.onValueChange);

        // app events
        this.appEvents = ['contentChange'];
        this.appEventsHandler = {};
        this.appEvents.forEach(function(v){
            app.appEventsHandler[v] = [];
        });
        this.creating = true;
        this._create(this.data);
        this.creating = false;
    };

    /**
     * Get Node value
     * @param type
     * @returns {*}
     * @private
     */
    List.prototype._getValue = function (type) {
        if (type == 'current') {
            return this.rootNode.getValue();
        }

        if (type == 'root') {
            return this.veryRootNode.getValue();
        }
    };

    List.prototype.getRootValue = function () {
        return this._getValue('root');
    };

    List.prototype.getCurentValue = function () {
        return this._getValue('current');
    };

    List.prototype.onValueChange = function () {
        //this.saver.save();
        //this.controller.onEvent('valueChange')
    };

    /**
     * Create DOM of the list
     * @param data
     * @private
     */
    List.prototype._create = function (data) {
        var app = this;
        var self = this
        var rootNode = new Node(data, app);
        rootNode.adjustDom({
            type: 'append',
            el: this.frame
        });
        rootNode.setRoot();
        this.rootNode = rootNode;
        this.veryRootNode = rootNode;

        var events = ['click', 'keydown', 'propertychange', 'keyup', 'paste', 'cut', 'input'];
        events.forEach(function (value) {
            app.frame.addEventListener(value, function(event){
                self.onEvent(event)
            })
        });
    };

    /**
     * Handle events on the application element
     */
    List.prototype.onEvent = function (event) {
        var node = Node.getNodeFromTarget(event.target);
        if (node) {
            node.onEvent(event);
        }
    };

    List.prototype._createTitle = function (node) {
        var titleText = node.getContent();
        if (node == this.veryRootNode) {
            this.frame.removeChild(this.titleElement);
            this.titleElement = undefined;
            return;
        }
        if (this.titleElement) {
            this.titleText = titleText;
            this.titleElement.innerText = titleText;
        } else {
            // create title dom
            var title = document.createElement('div');
            title.innerHTML = titleText;
            title.setAttribute('contentEditable', true);
            title.className += "rootnode-title";
            this.titleElement = title;
            // insert to dom
            if ($(this.frame).children()) {
                $(this.frame).children().first().before(title);
            } else {
                this.frame.appendChild(title);
            }
        }
    };

    /**
     * Show 'Add Child' button when you zoom into the bottom node
     * @private
     */
    List.prototype._createAddButton = function () {
        var self = this;
        this.addChildButton = Util.getDomFromHtml('<div class="add-wrapper"><a href="#">Add a child</a></div>')
        this.frame.appendChild(this.addChildButton)

        this.addChildButton.addEventListener('click', function(event){
            self.rootNode.createChild({})
            self.frame.removeChild(self.addChildButton)
        })
    };

    /**
     * Store history when a node is moved, removed, duplicated, etc.
     * @param {String} action action name
     * @param {Object} option
     */
    List.prototype.onAction = function (action, option) {
        if (action == 'zoomin') {
            var node = option.node;
            if (!node) {
                return;
            }
            this.zoomIn(node);
        }
        if (action == 'valueChange' && option.node == this.veryRootNode) {
            this.eventMgr.fire('valueChange', null, this);
        }
        // add action to history
        if (this.history) {
            this.history.add(action, option);
        }
    };

    List.prototype.onRootNodeChange = function (newRootnode) {
        // handle crumb
        if (newRootnode == this.veryRootNode) {
            this.crumb.hide();
        } else {
            this.crumb.render();
        }

        // handle add buttons
        // todo 让这些元素的创建顺序不要影响他们最终出现在DOM中得位置
        if (this.addBtnWrapper) {
            this.frame.removeChild(this.addBtnWrapper);
            this.addBtnWrapper = undefined;
        }
    };
    List.prototype.zoomIn = function (node, hasContent) {
        this.creating = true;
        var newRootNode = node;
        if (!newRootNode) {
            return;
        }
        this.frame.removeChild(this.rootNode.row);
        // TODO 这个refreshDom，问题大大的
        newRootNode.refreshDom();
        newRootNode.setRoot();
        newRootNode.adjustDom({
            type: 'append',
            el: this.frame
        });
        this.rootNode = newRootNode;
        this._createTitle(this.rootNode);
        //this._createBread();
        this.eventMgr.fire('rootNodeChange', this.rootNode, this);
        if (hasContent === false ||
            (hasContent == undefined && !this.rootNode.hasChild())) {
            this._createAddButton();
        }
        this.creating = false;
    };

    /**
     * Add event handlers from outside. events:
     * 'contentChange',
     * @example: app.on('contenteChange', function(){
     *      self.handler();
     * })
     * @param {String} eventName
     * @param {Function} handler
     */
    List.prototype.on = function(eventName, handler){
        var eventsList = ['contentChange'];
        if(eventsList.indexOf(eventName) == -1){
            return;
        }
        this.appEventsHandler[eventName].push(handler);
    };



    /*========================================================
                          Bread crumb manager
      ========================================================*/
    var Crumb = function (app) {
        if (!app) {
            return;
        }
        this.app = app;
        this.app.eventMgr.addListener('rootNodeChange', this.onRootNodeChange);
    };
    /**
     * Get dom for the crumb wrapper
     * @param path
     * @returns {Array} array contains all the dom of the crumb
     */
    Crumb.prototype.getDom = function (path) {
        var app = this.app;
        var self = this;
        var domArray = [];
        path.forEach(function (v, i) {
            var content = v.getContent();
            if (v == app.veryRootNode) {
                content = 'Home';
            } else if (v.getContent() == "") {
                content = 'noname';
            }
            var link = crel('div', {class: 'crumb-link'},
                crel('a', {href: '#' + v.id}, content),
                '>'
            );

            domArray.push(link);
        });
        return domArray;
    };

    /**
     * Append links to the crumb
     * or create crumb if not exist
     * and the append the links
     */
    Crumb.prototype.render = function () {
        var app = this.app;
        var self = this;
        if (app.crumbElement) {
            app.crumbElement.innerHTML = "";
            var path = this.app.rootNode.getPath();
            var domArr = this.getDom(path);
            domArr.forEach(function (v, i) {
                app.crumbElement.appendChild(v);
                // add event listener
                $(v).find('a').on('click', function () {
                    self.onEvent($(this));
                });
            });
        } else {
            // create a crumb wrapper and render again
            app.crumbElement = crel('div', {class: 'crumb'});
            if ($(app.frame).children()) {
                $(app.frame).children().first().before(app.crumbElement);
            } else {
                app.frame.appendChild(app.crumbElement);
            }
            this.render();
        }
    };
    Crumb.prototype.hide = function () {
        var app = this.app;
        if (app.crumbElement) {
            app.frame.removeChild(app.crumbElement);
            app.crumbElement = undefined;
        }
    };
    Crumb.prototype.onEvent = function ($this) {
        var app = this.app;
        var id = $this.attr('href').slice(1);
        var targetNode;
        var node = app.rootNode.parent;
        while (node) {
            if (node.id == id) {
                targetNode = node;
                break;
            } else {
                node = node.parent;
            }
        }
        app.zoomIn(targetNode);
    };
    Crumb.prototype.onRootNodeChange = function (newRootnode) {
        // handle crumb
        if (newRootnode == this.veryRootNode) {
            this.crumb.hide();
        } else {
            this.crumb.render();
        }

        // handle add buttons
        // todo 让这些元素的创建顺序不要影响他们最终出现在DOM中得位置
        if (this.addChildButton) {
            this.frame.removeChild(this.addChildButton);
            this.addChildButton = undefined;
        }

        // save changes
    };

    return List
});
