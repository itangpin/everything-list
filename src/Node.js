/**
 * @author 唐品 (Tang Pin)
 * created at 2015-2-8
 */
define(['./util'],function(util){

    var Node = function(value,app,parent){
        this.value = value;
        this.formatValue();
        this.app = app;
        this.parent = parent
        this.childs = [];
        this.childrenMap = {};
        this.isRootNode = false;
        this.id = util.uuid();
        this._createDom();
        this.getPath()
        this.collapseAnimating = false
    };

    /*=============================================================
     *                    Static Methods
     ==============================================================*/
    /**
     * Get the node instance by the event.target
     * The application would use it to determin
     * which node to dispatch events to
     * @param target
     * @returns {*}
     */
    Node.getNodeFromTarget = function(target){
        while (target) {
            if (target.node) {
                return target.node;
            }
            target = target.parentNode;
        }
        return undefined;
    };


    /**
     * Re-calculate the path of the node's parents
     */
    Node.prototype.refreshPath = function(){
        this.path = [];
        var node = this;
        while(node){
            if(node.parent){
                this.path.unshift(node.parent);
            }
            node = node.parent;
        }
    };
    /**
     * Get the path of the node
     * last element of the array is the closest parent of the node
     * @returns {Array}
     */
    Node.prototype.getPath = function(){
        this.refreshPath();
        return this.path;
    };

    /**
     * Create the dom of the Node
     * @private
     */
    Node.prototype._createDom = function(){
        // the round dot
        var dot = crel('a',{class:'dot'},
            crel('span',{class:'b'},
                crel('span',{class:'s'}))
        );
        // text content
        var content = crel('div',{class:'project-content',contentEditable:true});
        // children wrapper
        var children = crel('div',{class:'children'});
        var row = crel('div',{class:'project', projectId:this.id}, dot, content, children);
        // used when finding node from event target(target.node)
        row.node = this;
        this.buttonElement = dot;
        this.contentElement = content;
        this.childrenElement = children;
        this.row = row;

        this.setValue();
    };

    /**
     * Rerender DOM structure with current data
     */
    Node.prototype.refreshDom = function(){
        this.childs = [];
        this.childrenMap = {};
        this._createDom();
    };

    /**
     * Add the created Node to the DOM
     * @param position
     */
    Node.prototype.adjustDom = function(position){
        var self = this;

        if(position){
            switch (position.type){
                case 'after':
                    insertAfter(position.el);
                    break;
                case 'append':
                    appendInside(position.el);
                    break;
                case 'before':
                    insertBefore(position.el)
                    break
                default:
                    break;
            }
        }else{
            this.parent.appendChild(this.row);
        }

        function insertAfter(el){
            $(el).after(self.row);
        }
        function appendInside(el){
            $(el).append(self.row);
        }
        function insertBefore(el){
            $(el).before(self.row)
        }
    };

    /**
     * Handle events
     * @param {event object} event event object from browser
     */
    Node.prototype.onEvent = function(event){
        var type = event.type;
        var target = event.target || event.srcElement;

        // Keyboard events
        if(type == 'keydown'){
            var keyNum = event.keyCode;
            // Ctrl + Enter new line
            if(keyNum==13 && event.ctrlKey){
                event.preventDefault();
                this.createSiblingNodeAfter();
                return false;
            }
            // Shift + Enter
            if(keyNum==13 && event.shiftKey){
                event.preventDefault();
                this.createSiblingNodeBefore()
                //this._onInsertBefore({});
                return false;
            }
            // Tab
            if(9 == event.keyCode){
                event.preventDefault();
                // Shift + Tab
                if(event.shiftKey){
                    this.unIndent();
                }else{
                    this.indent();
                }
                return false;
            }
            // Delete
            if(46 == event.keyCode){
                event.preventDefault();
                this.parent.removeChildAndDom(this);
                return false;
            }
            // Backspace on an 'empty' node
            if(8 == event.keyCode){
                if(this.getContent() == ""){
                    event.preventDefault()
                    var upNode = this.getRelativeNode('up')
                    this.parent.removeChildAndDom(this);
                    upNode.focus(upNode.contentElement)
                }
                return false
            }
        }

        // Mouse click events
        if(type == 'click'){
            if(target == this.buttonElement
                || target == this.buttonElement.childNodes[0]
                || target == this.buttonElement.childNodes[0].childNodes[0]){
                if(!event.altKey){
                    this._onZoomIn();
                }else{
                    this.collapse();
                }

            }
        }

        // content change
        if(event.type == 'input'){
            //this.onValueChange();
            this.onContentValueChange()
        }


        // send events to packages' handler
        this.packageEventsHandle(event);
    };

    /* ============================================================
     *                   Package Management
     * ============================================================*/

    /**
     * Let handlers from packages handle events
     * @param events
     */
    Node.prototype.packageEventsHandle = function(events){
        var thisNode = this;
        if(this.packageEvents && this.packageEvents.length){
            $.each(this.packageEvents, function(index,value){
                value.call(thisNode,events);
            });
        }
    };
    /**
     * Extend the node instance with package instance
     * @param packageNameList
     */
    Node.prototype.initPackages = function(){
        var thisNode = this;

        this.packageEvents = this.packageEvents || [];
        this.packages = this.app.getPackages();
        this.value.packageValue = this.value.packageValue || {};

        $.each(this.packages, function(index, value){
            if(value.node){
                $.extend(thisNode, value.node);
            }
            if(value.onEvent){
                thisNode.packageEvents.push(value.onEvent);
            }

        });
    };

    /* ============================================================
     *                   Data  Export && Import
     * ============================================================*/
    /**
     * Value change handler,
     * triggered be multiple events
     */
    Node.prototype.onValueChange = function(){
        if(this.app.creating){
            return;
        }
        this.updateValue();
        // notify parent node one of its child has changed
        if(this.parent){
            this.parent.onChildValueChange(this)
        }
        this.app.onAction('valueChange',{
            node:this
        });
    };
    Node.prototype.onContentValueChange = function(){
        this.value.content = this.contentElement.innerHTML
        if(this.parent){
            this.parent.onChildValueChange(this)
        }
    }
    /**
     * Handler for child node value change event
     * @param node
     */
    Node.prototype.onChildValueChange = function(node){
        //this.value.children[node.index] = node.value
        if(this.parent){
            this.parent.onChildValueChange(this)
        }
        this.app.onAction('valueChange', {
            node: this
        })
    }
    Node.prototype.updateValue = function(){
        this.value.content = this.contentElement.innerHTML
    };
    /**
     * Get value, value is a JSON structure
     */
    Node.prototype.getValue = function(node){
        var thisNode = this;
        this.value.content = this.contentElement.innerHTML;
        this.value.children = [];
        if(this.hasChild()){
            this.childs.forEach(function(v){
                thisNode.value.children.push(v.getValue());
            });
        }
        return this.value;
    };

    /**
     * Format the value into complete style
     */
    Node.prototype.formatValue = function(){
        if(Array.isArray(this.value)){
            // root node's value is an array
            this.value = {
                content: "",
                children: this.value,
                packageValue: {}
            };
            return this.value;
        }
        if((typeof this.value == 'string') || this.value.constructor == String){
            // string means no child nodes and no packageValue
            this.value = {
                content:this.value,
                children:[],
                packageValue:{}
            };
        }
        if(!this.value.content){
            this.value.content = "";
        }
        if(!this.value.children){
            this.value.children = [];
        }
    };

    /**
     * Set content and children of the node,
     * @param {String|Array|Object} value content of the Node
     */
    Node.prototype.setValue = function(value){
        if(value){
            // reset value
            this.value = value;
            this.formatValue();
        }
        if(this.value){
            this.formatValue()
            this._setContent(this.value.content);
            this.setChildren(this.value.children);
        }else{
            // create the node with null data
            this.setValue('');
        }
        // set children value changed status
        // when value first setted, it's all false
        this.childValueChanged = []
        var self = this
        this.value.children.forEach(function(value, index){
            self.childValueChanged[index] = false
        })
    };

    /**
     * Set the content
     * @param value
     * @private
     */
    Node.prototype._setContent= function(value){
        if((typeof value == 'string') || value.constructor == String){
            this.content = value;
            this.contentElement.innerHTML = this.content;
        }
    };
    /**
     * Change content.(For external use)
     * @param value
     */
    Node.prototype.setContent = function(value){
        if((typeof value == 'string') || value.constructor == String){
            this.content = value;
            this.contentElement.innerHTML = this.content;
            this.onContentValueChange();
        }
    }

    /**
     * Set parent Node
     * @param {Node}parent
     */
    Node.prototype.setParent = function(parent){
        this.parent = parent;
    };

    /**
     * Set the children Nodes
     * @param {Array} children value array to create children
     */
    Node.prototype.setChildren = function(children){
        var self = this;
        if(Array.isArray(children) && children.length>0) {
            children.forEach(function(value){
                self._createChild(value);
            });
            // change style of the dot if has children
            this.row.className += " hasChild";
        }
    };

    /**
     * Get the content of the row
     */
    Node.prototype.getContent = function(){
        this.content = this.contentElement.innerHTML;
        return this.content;
    };

    /**
     * Hide content of the Node,
     * show only the children.
     * Used when create root Node .etc
     */
    Node.prototype.setRoot = function(){
        this.row.classList.add('root');
        this.isRootNode = true;
    };

    /**
     * Tell the node which child of it
     * has its value changed
     * @param node
     */
    Node.prototype.childValueChanged = function(node){
        this.childValueChanged[node.index] = true
    }




/* ============================================================
 *                   Actions to move nodes
 * ============================================================*/

    /**
     * Create an empty Node after this node
     */
    Node.prototype.createSiblingNodeAfter = function(){
        var siblingNode = new Node({},this.app, this.parent);
        siblingNode.adjustDom({type:'after',el:this.row});
        this.parent._addChild(siblingNode,this.index+1);
        siblingNode.focus(siblingNode.contentElement);
    };
    Node.prototype.createSiblingNodeBefore = function(){
        var siblingNode = new Node({},this.app, this.parent)
        siblingNode.adjustDom({type:'before',el:this.row})
        this.parent._addChild(siblingNode, this.index-1)
        siblingNode.focus(siblingNode.contentElement)
    }   /**
     * Indent the Node,
     * turn the  node into a child node of the sibling node before it.
     */
    Node.prototype.indent = function(){
        var prevNode = this.getRelativeNode('prev')
        if(prevNode){
            this.parent.removeChildAndDom(this)
            prevNode.appendChild(this)
            this.parent = prevNode
            this.focus(this.contentElement)
        }
        this.onValueChange(this.parent);
    };

    Node.prototype.unIndent= function(){
        if(this.parent.isRootNode){
            return;
        }else{
            this.parent.removeChildAndDom(this)
        }
        this.parent.addSiblingNodeAfter(this)
    };
    /**
     * Get sibling node before/after this node,
     * get parent node,
     * get child nodes
     * @param position
     */
    Node.prototype.getRelativeNode = function(position){
        switch (position){
            case 'before':
                var prevNodeElement = this.row.previousSibling;
                if(prevNodeElement){
                    var prevNodeId = prevNodeElement.getAttribute('projectId');
                    return this.parent.findChildById(prevNodeId);
                }else{
                    return null;
                }
                break;
            case 'after':
                if(this.parent){
                    var afterNode = this.parent.childs[this.index+1];
                    if(afterNode){
                        return afterNode;
                    }else{
                        return null;
                    }
                }else{
                    return null;
                }
                break;

            // get previous sibling node
            // todo replace 'before' case
            case 'prev':
                if(this.index == 0 || this.isRootNode){
                    return undefined
                }else{
                    return this.parent.childs[this.index-1]
                }
                break

            // get previous sibling node
            // or parent node if this is the first child
            case 'up':
                if(this.index == 0 && !this.isRootNode){
                    return this.parent
                }else{
                    return this.parent.childs[this.index-1]
                }
                break
        }
    };
    /**
     * Add a Node as a sibling Node right after this node
     * @param node
     */
    Node.prototype.addSiblingNodeAfter = function(node){
        this.parent._addChild(node,this.index+1)
        $(this.row).after(node.row)
        this.onValueChange(this.parent);
    };

/* ============================================================
 *                   Actions of child nodes
 * ============================================================*/

    /**
     * For internal use
     * called when initiating this node's child nodes
     * @private
     * @param {object} value
     */
    Node.prototype._createChild = function(value){
        var childNode = new Node(value, this.app, this);
        childNode.adjustDom({type:'append',el:this.childrenElement});
        this.childs.push(childNode)
        childNode.index = this.childs.length-1;
        this.childrenMap[childNode.id] = childNode;
        //this._addChild(childNode);
        childNode.focus(childNode.contentElement);
    };
    /**
     * For external use
     * The difference form _createChild is that
     * it would change the 'value' of the node
     * while _createChild won't because _createChild method
     * create child from existing value(_addChild())
     * @param {Object} value
     */
    Node.prototype.createChild = function(value){
        var newNode = new Node(value, this.app, this)
        newNode.adjustDom({type:'append',el:this.childrenElement});
        this._addChild(newNode)
    }
    /**
     * Append a child Node at the tail of the Node
     * @param child
     */
    Node.prototype.appendChild = function(child){
        this.childrenElement.appendChild(child.row);
        this._addChild(child);
        this.onValueChange(this.parent);
    };
    /**
     * Add a node to the children node map
     * @childNode {Node} node to be add
     * @position {Number} position to insert into array
     * @private
     */
    Node.prototype._addChild = function(childNode,position){
        if(position){
            this.value.children.splice(position,0,childNode.value)
            this.childs.splice(position,0,childNode)
            childNode.index = position
        }else{
            // creating the list
            this.value.children.push(childNode.value)
            this.childs.push(childNode);
            childNode.index = this.childs.indexOf(childNode)
            childNode.row.setAttribute('index', childNode.index)
        }
        this.childrenMap[childNode.id] = childNode;
        this.onChildValueChange(childNode)
    };

    /**
     * Remove specific child
     * @param {Node}node of the child Node
     */
    Node.prototype.removeChild = function(node){
        this.childs.splice(node.index,1)
        this.childrenMap[node.id] = undefined;
        this.value.children.splice(node.index, 1)
        if(this.parent){
            this.parent.onChildValueChange(this)
        }
    };

    Node.prototype.removeChildAndDom = function(node){
        if(node.row.parentNode){
            node.row.parentNode.removeChild(node.row);
        }
        this.removeChild(node);
    };

    /**
     * Tell if the Node has children
     */
    Node.prototype.hasChild = function(){
        return this.childs.length > 0;
    };

    Node.prototype._onZoomIn = function(){
        this.app.onAction('zoomin',{
            node:this
        });
    };

    /**
     * Focus on the element
     * TODO: need to be rewrite
     */
    Node.prototype.focus = function(el){
        //var el = this.contentElement;
        var range = document.createRange();
        var sel = window.getSelection();
        if(el.innerHTML.length){
            range.setStart(el,1);
            range.setEnd(el,1);
        }else{
            range.setStart(el,0);
            range.setEnd(el,0);
        }
        sel.removeAllRanges();
        sel.addRange(range);
        el.focus();
    };
    Node.prototype.blur = function(){
        this.contentElement.blur();
    };

    /**
     * Collapse the children of the Node
     * @param {boolean} recursion
     */
    Node.prototype.collapse = function(recursion){
        if(this.collapseAnimating){return;}
        this.collapseAnimating = true;
        if(!this.hasChild()){
            return;
        }
        // $(this.childrenElement).slideToggle(200);
        var self = this;
        if($(this.childrenElement).hasClass('collapse')){
           $(self.row).removeClass('collapse');
           $(this.childrenElement).animate({height:this.childrenHeight}, 200, function(){
                   $(this).removeClass('collapse');
                   $(this).removeAttr('style');
                   self.collapseAnimating = false;
           });
        }else{
           this.childrenHeight = $(this.childrenElement).height();
           $(self.row).addClass('collapse');
           $(this.childrenElement).animate({height:0},200,function(){
               $(this).addClass('collapse');
               self.collapseAnimating = false;
           });
        }

    };

    Node.prototype.expand = function(){};

    Node.prototype.findChildById = function(id){
        return this.childrenMap[id];
    };

    return Node;
});
