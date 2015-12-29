/**
 * @file a custom treemap
 * @author chenwubai.cx@gmail.com
 */
(function(window) {
    var d3 = window.d3;

    function xTree(container) {
        if(!d3) {
            console.error('The library depends on d3js http://d3js.org/');
            return;
        }
        return xTree.prototype.init(container);
    }

    xTree.prototype.extend = function(obj) {
        for (var k in obj) {
            if (obj.hasOwnProperty(k))
                this[k] = obj[k];
        }
    }

    xTree.prototype.extend({
        init: function(container) {
            container = d3.select(container);
            this.container = container;
            this.svgSize = {
                width: getWidth(container.node()),
                height: getHeight(container.node())
            };
            this.svg = this.container.append('svg')
                .attr('width', this.svgSize.width)
                .attr('height', this.svgSize.height);

            return this;
        },
        loadConfig: function(config) {
            this.config = copy(config, true);
            this.draw(this.config);
        },
        draw: function(config) {
            this.calculate(config, config.data);
            this.render();
            this.ready();
        },
        calculate: function(config, originalData) {
            var _self = this;

            var tree = d3.layout.tree()
                .size([_self.svgSize.width, _self.svgSize.height]);
            _self.nodesData = tree.nodes(originalData);
            _self.linksData = tree.links(_self.nodesData);

            // 计算最后一层节点相对父节点的水平偏移距离
            _self.config.distances.distance = _self.config.btnStyle.radius + 10;
            // 计算节点按钮中'+'、'-'的大小
            _self.config.btnStyle.textSize = (_self.config.btnStyle.radius - 3)*2;

            // 计算每个文字标签的宽高
            _self.setLabelSize(_self.nodesData, _self.config);

            // 求出最大深度
            _self.maxDepth = d3.max(_self.nodesData, function(d) {
                return d.depth;
            });

            // 设置所有节点的y坐标和子节点展开状态
            _self.setNodesY(_self.nodesData);

            // ----- 计算节点的x坐标 -----
            // 计算倒数第二层的节点的x坐标
            var secondBtmNodeData = _self.setSecondBtmNodeX();
            // 计算除叶子节点和倒数第二层以外的节点的x坐标
            _self.setOtherNodeX();
            // 计算最后一层的x坐标和y坐标
            _self.setBtmNodeXY(secondBtmNodeData);

            // 计算每条连线的折线上的点坐标
            _self.setLinkPoints();
        },
        render: function() {
            var _self = this;
            // 添加整个树状图的分组容器
            _self.main = this.svg.append('g')
                .classed('main', true)
                .attr('transform', 'translate(' + (_self.svgSize.width-_self.secondBtmWidth)/2 + ',' + this.config.margin.top + ')');
            // 添加连线
            _self.lineEleList = _self.renderLineEle(_self.main);

            // 添加节点
            _self.nodeEleList = _self.renderNodeEle(_self.main);

            // 考虑服务端返回的data为[]的情况
            if(_self.nodesData.length == 1) {
                _self.nodeEleList.attr('transform', 'translate(0,0)')
                    .classed('none', false);
            }
        },
        ready: function() {
            if(this.config.allowDrag) {
                this.svgReady();
            }
            this.nodeBtnReady();
        },
        setLabelSize: function(nodesData, config) {
            var tempTextEle = this.container
                .append('span')
                .style({
                    'display': 'inline-block',
                    'font-size': config.labelStyle.textSize + 'px'
                });
            for(var i=0;i<nodesData.length;i++) {
                var d = nodesData[i];
                tempTextEle.text(d.name);
                d.width = css(tempTextEle.node(), 'width', true) + 2*config.labelStyle.padding;
                d.height = css(tempTextEle.node(), 'height', true) + 2*config.labelStyle.padding;
            }
            tempTextEle.remove();
        },
        setNodesY: function(nodesData) {
            var _self = this;
            nodesData.forEach(function(node) {
                if(node.depth == _self.maxDepth-1) {
                    node.isHideChildren = true;
                } else {
                    node.isHideChildren = false;
                }
                node.y = node.depth * _self.config.distances.verticalMargin;
            });
        },
        setSecondBtmNodeX: function() {
            var _self = this;
            var bottomNodeDataArr = new Array();
            _self.nodesData.forEach(function(node) {
                if(node.depth == _self.maxDepth-1) {
                    bottomNodeDataArr.push(node);
                }
            });
            // 设置倒数第二层节点的x坐标
            _self.secondBtmWidth = bottomNodeDataArr.reduce(function(pre, cur, i , arr) {
                cur.x = pre;
                if(i == arr.length-1) {
                    pre = pre + cur.width
                } else {
                    var allChildren = new Array();
                    _self.linksData.forEach(function(link) {
                        if(link.source == cur) {
                            allChildren.push(link.target);
                        }
                    });
                    var hMargin = 10;
                    if(allChildren.length) {
                        hMargin = d3.max(allChildren, function(child) {
                            return child.width;
                        });
                    }
                    pre = pre + cur.width + hMargin;
                }
                return pre;
            }, 0);
            return bottomNodeDataArr;
        },
        setOtherNodeX: function() {
            var _self = this;
            for(var i=_self.maxDepth-2;i>=0;i--) {
                // 找出该层的所有节点
                var sameLevelArr = new Array();
                _self.nodesData.forEach(function(node) {
                    if(i == node.depth) {
                        sameLevelArr.push(node);
                    }
                });
                for(var k=0;k<sameLevelArr.length;k++) {
                    // 找出该节点的所有子节点
                    var parent = sameLevelArr[k];
                    var allChildren = new Array();
                    _self.linksData.forEach(function(link) {
                        if(link.source == parent) {
                            allChildren.push(link.target);
                        }
                    });
                    if(allChildren.length == 0) {
                        if(k == 0) {
                            parent.x = 0;
                        } else {
                            var hMargin = 10;
                            parent.x = sameLevelArr[k-1].x + sameLevelArr[k-1].width + hMargin;
                        }
                    } else {
                        var xRange = d3.extent(allChildren, function(child) {
                            return child.x;
                        });
                        xRange[1] += allChildren[allChildren.length - 1].width;

                        parent.x = xRange[0] + (xRange[1] - xRange[0] - parent.width)/2;
                    }
                }
            }
        },
        setBtmNodeXY: function(secondBtmNodeData) {
            var _self = this;
            secondBtmNodeData.forEach(function(parent) {
                // 找出该节点的所有子节点
                var allChildren = new Array();
                _self.linksData.forEach(function(link) {
                    if(link.source == parent) {
                        allChildren.push(link.target);
                    }
                });
                allChildren.reduce(function(pre, cur, i, arr) {
                    cur.x = parent.x + parent.width/2 + _self.config.distances.distance;
                    cur.y = pre;
                    pre += cur.height + _self.config.distances.lastVerticalMargin;
                    return pre;
                }, parent.y + parent.height + 2*_self.config.btnStyle.radius + _self.config.distances.distanceToBtn);
            });
        },
        setLinkPoints: function() {
            var _self = this;
            _self.linksData.forEach(function(link) {
                var parent = link.source,
                    child = link.target;
                link.points = '';
                if(link.target.depth != _self.maxDepth) {
                    link.points += (parent.x + parent.width/2) + ',' + parent.y;
                    link.points += ' ' + (parent.x + parent.width/2) + ',' + ((child.y + parent.y + parent.height)/2);
                    link.points += ' ' + (child.x + child.width/2) + ',' + ((child.y + parent.y + parent.height)/2);
                    link.points += ' ' + (child.x + child.width/2) + ',' + child.y;
                } else {
                    link.points += (parent.x + parent.width/2) + ',' + parent.y;
                    link.points += ' ' + (parent.x + parent.width/2) + ',' + (child.y + child.height/2);
                    link.points += ' ' + child.x + ',' + (child.y + child.height/2);
                }
            });
        },
        renderLineEle: function(mainEle) {
            var _self = this;
            var lineWrapper = mainEle.append('g')
                .classed('lineWrapper', true);
            var lineEleList = lineWrapper.selectAll('.line')
                .data(this.linksData)
                .enter()
                .append('polyline')
                .classed('line', true)
                .attr('points', function(d) {
                    return d.points;
                })
                .classed('none', function(d) {
                    if(d.target.depth == _self.maxDepth) {
                        return true;
                    }
                    return false;
                });
            return lineEleList;
        },
        renderNodeEle: function(mainEle) {
            var _self = this;
            // 添加节点
            var nodeWrapper = mainEle.append('g')
                .classed('nodeWrapper', true);
            var nodeEleList = nodeWrapper.selectAll('.node')
                .data(_self.nodesData)
                .enter()
                .append('g')
                .classed('node', true)
                .attr('transform', function(d) {
                    return 'translate(' + d.x + ',' + d.y + ')';
                })
                .classed('none', function(d) {
                    if(d.depth == _self.maxDepth) {
                        return true;
                    }
                    return false;
                });
            // 添加节点的展示部分
            _self.nodeLabelList =  _self.renderNodeLabel(nodeEleList);

            // 添加节点的按钮部分
            _self.nodeBtnList = _self.renderNodeBtn(nodeEleList);

            return nodeEleList;
        },
        renderNodeLabel: function(nodeEleList) {
            var _self = this;
            var nodeLabelList = nodeEleList.append('g')
                .classed('nodeLabel', true);
            nodeLabelList.append('rect')
                .classed('nodeLabelBox', true)
                .attr('width', function(d) {
                    return d.width;
                })
                .attr('height', function(d) {
                    return d.height;
                });
            nodeLabelList.append('text')
                .classed('nodeLabelText', true)
                .text(function(d) {
                    return d.name;
                })
                .attr('x', _self.config.labelStyle.padding)
                .attr('y', function(d) {
                    return d.height - _self.config.labelStyle.padding;
                })
                .style('font-size', _self.config.labelStyle.textSize + 'px');
            return nodeLabelList;
        },
        renderNodeBtn: function(nodeEleList) {
            var _self = this;
            var nodeBtnList = nodeEleList.append('g')
                .classed('nodeBtn', true)
                .attr('transform', function(d) {
                    return 'translate(' + d.width/2 + ',' + (d.height+_self.config.btnStyle.radius) + ')';
                });
            nodeBtnList.append('circle')
                .classed('nodeBtnBox', true)
                .attr('r', function(d) {
                    return d.children ? _self.config.btnStyle.radius : 0;
                });
            nodeBtnList.append('text')
                .classed('nodeBtnText', true)
                .text(function(d) {
                    if(d.depth == _self.maxDepth-1) {
                        return '十';
                    }
                    return '一';
                })
                .style({
                    'display': function(d) {
                        return d.children ? 'inherit' : 'none';
                    },
                    'font-size': _self.config.btnStyle.textSize + 'px'
                })
                .attr('x', -_self.config.btnStyle.textSize/2)
                .attr('y', _self.config.btnStyle.textSize/2);
            return nodeBtnList;
        },
        svgReady: function() {
            var _self = this;
            var mainOffset = [ (_self.svgSize.width-_self.secondBtmWidth)/ 2, _self.config.margin.top],
                isDown = false;
            // 拖动查看可见区域外的结构
            _self.svg.on('mousedown', function() {
                isDown = true;
            });
            _self.svg.on('mousemove', function() {
                if(isDown) {
                    var movementX = d3.event.movementX,
                        movementY = d3.event.movementY;
                    mainOffset[0] += movementX;
                    mainOffset[1] += movementY;
                    _self.main.attr('transform', 'translate(' + mainOffset[0] + ',' + mainOffset[1] + ')');
                }
            });
            _self.svg.on('mouseup', function() {
                isDown = false;
            });
        },
        nodeBtnReady: function() {
            var _self = this;
            _self.nodeBtnList.on('click', function(nodeData) {
                if(!nodeData.isHideChildren) {
                    hideChildren(nodeData, _self.linksData, _self.lineEleList, _self.nodeEleList);
                } else {
                    showChildren(nodeData, _self.linksData, _self.lineEleList, _self.nodeEleList);
                }
            });
        }
    });

    // 一些内部函数

    /**
     * @description 获取元素的css属性值
     * @param ele 需要获取css属性值的元素
     * @param property 需要获取值的css属性
     * @param isTurnToNum 是否转换成数值
     * @returns css属性值
     */
    function css(ele, property, isTurnToNum){
        var style = getComputedStyle(ele);
        var value = style[property];

        return isTurnToNum ? parseFloat(value) : value;
    }
    function getWidth(ele){
        var width = css(ele,'width',true);
        if(css(ele,'boxSizing')!=='border-box'){
            return width;
        }
        width = width - css(ele,'borderLeftWidth',true)
            - css(ele,'paddingLeft',true)
            - css(ele,'paddingRight',true)
            - css(ele,'borderRightWidth',true);
        return width;
    }
    function getHeight(ele){
        var height = css(ele,"height",true);
        if(css(ele,'boxSizing')!=='border-box'){
            return height;
        }
        height = height - css(ele,'borderTopWidth',true)
            - css(ele,'paddingTop',true)
            - css(ele,'paddingBottom',true)
            - css(ele,'borderBottomWidth',true);
        return height;
    }
    /**
     * 复制变量
     * @param {anyType} source - 需要复制的对象
     * @param {boolean} deep - 是否深复制
     * @returns {anyType} - 复制出的新变量
     */
    function copy(source, deep) {
        if(!source) {
            return source;
        }
        var type = getType(source);
        if(type == "Object" || type == 'Array'){
            var clone = type == 'Object' ? {} : [];
            var value;
            for(var prop in source){
                if(source.hasOwnProperty(prop)) {
                    value = source[prop];
                    if(deep && (getType(value) == 'Object' || getType(value) == 'Array')){
                        clone[prop] = arguments.callee(value,true);
                    } else {
                        clone[prop] = source[prop];
                    }
                }
            }
            return clone;
        } else {
            return source;
        }
    }
    /**
     * 获取变量的类型
     * @param {anyType} value - 变量
     * @returns {string} - 变量数据类型
     */
    function getType(value) {
        var string = Object.prototype.toString.call(value);
        var type = string.match(/\[object\s(\w+?)\]/)[1];
        return type;
    }
    // 隐藏所有孩子节点以及后代节点
    function hideChildren(nodeData, linksData, lineEleList, nodeEleList) {
        var ele = {};
        for(var i=0;i<nodeEleList[0].length;i++) {
            if(d3.select(nodeEleList[0][i]).datum() == nodeData) {
                ele = d3.select(nodeEleList[0][i]);
                break;
            }
        }
        nodeData.isHideChildren = true;
        ele.select('.nodeBtnText').text('十');
        var selectedLinks = new Array(),
            selectedChildren = new Array();
        linksData.forEach(function(link) {
            if(link.source == nodeData) {
                selectedLinks.push(link);
                selectedChildren.push(link.target);
            }
        });
        if(selectedLinks.length && selectedChildren.length) {
            // 该节点非叶子节点
            selectedLinks.forEach(function(link) {
                for(var k=0;k<lineEleList[0].length;k++) {
                    var lineEle = d3.select(lineEleList[0][k]);
                    if(link == lineEle.datum()) {
                        lineEle.classed('none',true);
                        break;
                    }
                }
            });
            selectedChildren.forEach(function(child) {
                for(var k=0;k<nodeEleList[0].length;k++) {
                    var nodeEle = d3.select(nodeEleList[0][k]);
                    if (child == nodeEle.datum()) {
                        nodeEle.classed('none', true);
                        nodeEle.select('.nodeBtnText').text('十');
                        break;
                    }
                }
                //child.isHideChildren = true;
                hideChildren(child, linksData, lineEleList, nodeEleList);
            });
        }
        nodeData.isHideChildren = true;
    }
    // 只展开属于孩子节点的后代节点
    function showChildren(nodeData, linksData, lineEleList, nodeEleList) {
        var ele = {};
        for(var i=0;i<nodeEleList[0].length;i++) {
            if(d3.select(nodeEleList[0][i]).datum() == nodeData) {
                ele = d3.select(nodeEleList[0][i]);
                break;
            }
        }
        nodeData.isHideChildren = false;
        ele.select('.nodeBtnText').text('一');
        var selectedLinks = new Array(),
            selectedChildren = new Array();
        linksData.forEach(function(link) {
            if(link.source == nodeData) {
                selectedLinks.push(link);
                selectedChildren.push(link.target);
            }
        });
        selectedLinks.forEach(function(link) {
            for(var k=0;k<lineEleList[0].length;k++) {
                var lineEle = d3.select(lineEleList[0][k]);
                if(link == lineEle.datum()) {
                    lineEle.classed('none',false);
                    break;
                }
            }
        });
        selectedChildren.forEach(function(child) {
            for(var k=0;k<nodeEleList[0].length;k++) {
                var nodeEle = d3.select(nodeEleList[0][k]);
                if (child == nodeEle.datum()) {
                    nodeEle.classed('none', false);
                    break;
                }
            }
        });
        nodeData.isHideChildren = false;
    }


    window.xTree = xTree;
}(window))