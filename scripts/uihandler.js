'use strict';

/*
This is probably one of the more confusing parts of this codebase and its one of the parts that breaks most.
The general idea is that everything is a "widget" and extends WidgetBase
WidgetGroups are widgets that contain other widgets. They have an axis (x/y) and each child has a size which is a percentage of the parent group's size on the specified axis.
WidgetTabGroups are widgets that contain other widgets, but only widget is visible at a time.
Widgets extend WidgetBase and are what most widgets should extend. See widgets.js for those.
The idea is that this is mostly standalone and could be moved into other projects with minimal changes.
 */

/**
 * Clamps a value to a minimum and maximum
 * @param value The value to be clamped
 * @param min The minimum value
 * @param max The maximum value
 * @returns {number}
 */
Math.clamp = function(value, min, max) {
    return Math.max(Math.min(value, max), min)
}

//#region IO Helper functions/abstraction

/** Creates a element node with classes, attributes, and automatically adds it as a child to another element */
function element(type, classes = "", attributes = {}, appendTo = null) {
    let el = document.createElement(type)
    el.className = classes
    if (typeof attributes["style"] !== "undefined") {
        for (let s of Object.keys(attributes["style"])) {
            el.style[s] = attributes["style"][s]
        }
        delete attributes["style"]
    }
    for (let attr of Object.keys(attributes)) {
        el.setAttribute(attr, attributes[attr])
    }
    if (appendTo !== null && appendTo !== undefined) appendTo.appendChild(el)
    return el
}

let _touchpos = [0,0]
let _moveEvents = []
let _upEvents = []
let _cancelEvents = []
document.body.addEventListener("touchstart", (e) => {
    _touchpos = [e.touches[0].clientX, e.touches[0].clientY]
})

/**
 * Callback will be passed in event with clientX, clientY, mobile, and "raw" for raw event
 */
function addDownEvent(el, callback) {
    el.addEventListener("mousedown", (e) => {
        callback({
            clientX: e.clientX,
            clientY: e.clientY,
            mobile: false,
            raw: e
        })
    })
    el.addEventListener("touchstart", (e) => {
        callback({
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            mobile: true,
            raw: e
        })
    })
}

/**
 * Callback will be passed in event with clientX, clientY, mobile, and "raw" for raw event
 */
function addMoveEvent(callback) {
    _moveEvents.push(callback)
}
document.body.addEventListener("mousemove", (e) => {
    for (let callback of _moveEvents)
        callback({
            clientX: e.clientX,
            clientY: e.clientY,
            movementX: e.movementX,
            movementY: e.movementY,
            mobile: false,
            raw: e
        })
})
document.body.addEventListener("touchmove", (e) => {
    for (let callback of _moveEvents) {
        callback({
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            movementX: e.touches[0].clientX - _touchpos[0],
            movementY: e.touches[0].clientY - _touchpos[1],
            mobile: true,
            raw: e
        })
    }
    _touchpos = [e.touches[0].clientX, e.touches[0].clientY]
})

/** touchcancel or mouseleave*/
function addCancelEvent(callback) {
    document.body.addEventListener("mouseleave", callback)
    document.body.addEventListener("touchcancel", callback)
}

/**
 * Callback will be passed in event with clientX, clientY, mobile, and "raw" for raw event
 */
function addUpEvent(callback) {
    document.body.addEventListener("mouseup", (e) => {
        callback({
            clientX: e.clientX,
            clientY: e.clientY,
            mobile: false,
            raw: e
        })
    })
    document.body.addEventListener("touchend", (e) => {
        callback({
            clientX: e.changedTouches[0].clientX,
            clientY: e.changedTouches[0].clientY,
            mobile: true,
            raw: e
        })
        _touchpos = [0,0]
    })
}
//#endregion

//#region Widgets
class WidgetBase {
    constructor() {
        this.w = 0
        this.h = 0
        this.el = document.createElement("div")
        this.el.className = "widget"

        this.minWidth = 100
        this.minHeight = 100

        this.type = "base"
        this.parent = null

        this.id = WidgetBase.generateId()
    }

    set width(to) {
        this.w = Math.max(to, this.minWidth)
        this.refresh()
    }
    get width() {
        return this.w
    }

    set height(to) {
        this.h = Math.max(to, this.minHeight)
        this.refresh()
    }
    get height() {
        return this.h
    }

    get name() {
        return this._name
    }
    set name(to) {
        this._name = to
    }

    canBeShrunkMore(axis) {
        if (axis === "x") return (this.width) > this.minWidth
        if (axis === "y") return (this.height) > this.minHeight
    }

    setSize(width, height) {
        this.w = Math.max(width, this.minWidth)
        this.h = Math.max(height, this.minHeight)
        this.refresh()
    }

    /**
     * A soft refresh - maybe width/height changed or some other action. Don't do significant processing in this step, as it may happen often.
     */
    refresh() {
        this.el.style.width = this.w + "px"
        this.el.style.height = this.h + "px"
    }

    /**
     * A hard refresh - something significant has changed and you should do stuff that will require processing here.
     */
    hardRefresh() {
        this.refresh()
    }

    /**
     * @returns {string}
     */
    static generateId() {
        let id = Date.now()

        let ascii = 65
        while (uniqueIds.includes(id + String.fromCharCode(ascii))) {
            if (++ascii == 90) id = id + Math.round(Math.random() * 26) + 65
        }
        id = "" + (id + String.fromCharCode(ascii))

        uniqueIds.push(id)
        return id
    }

    toString() {
        return this.name
    }

    out(a = {}) {
        return Object.assign({
            name: this.name,
            type: this.type,
        }, a)
    }
    in(a) {
        for (let field of Object.keys(a)) {
            this[field] = a[field]
        }
        this.hardRefresh()
    }

    static WidgetTypes = {

    }
}

class WidgetGroup extends WidgetBase {
    constructor() {
        super()
        this.children = []
        this.resizers = []
        this.el.className = "widget-holder"
        this.axis = "x" // Widget axis: x means that size impacts the width of the child widgets, and y impacts the height of the child widgets.

        this._name = "WidgetGroup"
        this.type = "group"
    }
    refresh(rescale = true) { // Rescale is the shrinking stuff
        this.refreshMinSizes()

        super.refresh()

        let resizerSize = this.resizers.length * (mobile ? 8 : 4)

        let tooSmall = []
        let shrinkRequired = 0

        if (this.width <= 0 || this.height <= 0) return

        // If no non-group children, and all children are a different axis, swap to their axis, and merge them into this
        if (this.children.length === 1 && this.children[0].widget.type === "group" && this.children[0].widget.axis !== this.axis) {
            let child = this.children[0].widget
            this.axis = child.axis
            this.removeChild(child, false)
            for (let grandchild of child.children) {
                this.addChild(grandchild.widget, grandchild.size, undefined, false)
            }
            //this.refresh()
            return
        }

        for (let child of this.children) {
            if (this.axis === "x") child.widget.setSize(child.size * (this.width - resizerSize), this.height)
            if (this.axis === "y") child.widget.setSize(this.width, child.size * (this.height - resizerSize))
            if (rescale && !child.widget.canBeShrunkMore(this.axis)) { // Group has shrunk this widget to less than its intended size.
                tooSmall.push(child)

                let childSize = child.size
                let minSize = (this.axis === "x" ? child.widget.minWidth : child.widget.minHeight) / ((this.axis ? this.width : this.height) - resizerSize)

                shrinkRequired += minSize - childSize

                child.size = minSize
            }

            // if child is group with only 1 widget, merge into this.
            if (child.widget.type === "group" && child.widget.children.length === 1) {
                let size = child.size
                let grandchild = child.widget.children[0].widget
                let index = this.indexOf(child.widget)
                this.removeChild(child.widget, false)
                this.addChild(grandchild, size, index, false)
                this.refresh()
                return
            }

            if (child.widget.type === "tabs" && child.widget.children.length === 1) {
                let size = child.size
                let grandchild = child.widget.children[0]
                let index = this.indexOf(child.widget)
                this.removeChild(child.widget, false)
                this.addChild(grandchild, size, index, false)
                this.refresh()
                return
            }

            if (child.widget.type === "group" && child.widget.axis === this.axis) {
                let index = this.indexOf(child.widget)
                let indexOffset = 0
                for (let grandchild of child.widget.children) {
                    this.addChild(grandchild.widget, grandchild.size * child.size, index + (++indexOffset), false)
                }
                this.removeChild(child.widget)
                this.refresh()
                return
            }
        }

        if (tooSmall.length > 0) {
            for (let child of this.children) {
                if (tooSmall.includes(child)) {
                    continue
                }
                child.size -= shrinkRequired / (this.children.length - tooSmall.length)
                //this.refresh()
            }
        }

        let totalSize = 0
        let biggestChild = {size: -1}
        for (let x of this.children) {
            totalSize += x.size
            if (biggestChild.size < x.size) biggestChild = x
        }

        if (totalSize > 1) {
            biggestChild.size -= (totalSize - 1)
            if (this.axis === "x") biggestChild.widget.setSize(biggestChild.size * (this.width - resizerSize), this.height)
            if (this.axis === "y") biggestChild.widget.setSize(this.width, biggestChild.size * (this.height - resizerSize))
        }
        if (totalSize < 0.98 && this.h !== 0 && this.children.length) {
            for (let child of this.children) {
                console.log(child.size, child.size / totalSize)
                child.size /= totalSize
                if (this.axis === "x") child.widget.setSize(child.size * (this.width - resizerSize), this.height)
                if (this.axis === "y") child.widget.setSize(this.width, child.size * (this.height - resizerSize))
            }
        }
    }
    hardRefresh() {
        super.hardRefresh();
        for (let child of this.children) child.widget.hardRefresh()
        this.refresh()
    }
    addChild(child, size = "unset", insertIndex = this.children.length, refresh = true) {
        if (child.type === "tabs" && child.children.length === 0) {
            return
        }
        if (child.type === "tabs" && child.children.length === 1) {
            child = child.children[0]
        }

        if (child.parent !== null) child.parent.removeChild(child, refresh)
        child.parent = this

        let totalSize = 0
        for (let x of this.children)
            totalSize += x.size
        console.log("adding child " + child.type + " with size " + size, "total size now " + (totalSize + size))

        if (totalSize >= 1) {
            if (size === "unset") size = 0.3
            for (let x of this.children)
                x.size *= (1-size)
        } else if (size === "unset") size = 1 - totalSize

        if (insertIndex === this.children.length) this.el.appendChild(child.el)
        else if (insertIndex === 0) this.el.prepend(child.el)
        else this.el.insertBefore(child.el, this.el.childNodes[insertIndex * 2 - 1])

        if (this.children.length) { // If already at least 1 child, add a resizer
            let resizer = document.createElement("div")
            resizer.className = "resizer"

            let moving = false
            addDownEvent(resizer, (e) => {
                moving = true
                if (!e.mobile) e.raw.preventDefault()
            })
            addMoveEvent((e) => {
                if (moving) {
                    let index = this.resizers.indexOf(resizer)
                    let widget1 = this.children[index]
                    let widget2 = this.children[index + 1]
                    let change = this.axis === "x" ? (e.movementX / this.width) : (e.movementY / this.height)
                    if (widget1.size * (this.axis === "x" ? this.width : this.height) >= (this.axis === "x" ? widget1.widget.minWidth : widget1.widget.minHeight) &&
                        widget2.size * (this.axis === "x" ? this.width : this.height) >= (this.axis === "x" ? widget2.widget.minWidth : widget2.widget.minHeight)
                    ) {
                        widget1.size += change
                        widget2.size -= change
                    }
                    this.refresh(false)
                    // console.log(widget1.widget.color, widget2.widget.color)
                }
            })
            addUpEvent(mouseUp)

            let self = this
            function mouseUp() {
                if (moving) {
                    moving = false

                    let index = self.resizers.indexOf(resizer)
                    let widget1 = self.children[index]
                    let widget2 = self.children[index + 1]
                    widget1.size = Math.max((self.axis === "x" ? widget1.widget.minWidth + 1 : widget1.widget.minHeight + 1) / (self.axis === "x" ? self.width : self.height), widget1.size)
                    widget2.size = Math.max((self.axis === "x" ? widget2.widget.minWidth + 1 : widget2.widget.minHeight + 1) / (self.axis === "x" ? self.width : self.height), widget2.size)
                }
            }

            if (insertIndex) this.el.insertBefore(resizer, child.el)
            else child.el.insertAdjacentElement("afterend", resizer)
            //this.el.appendChild(resizer)
            this.resizers.push(resizer)
            this.resizers.sort((a, b) => (this.axis === "x" ? a.offsetLeft - b.offsetLeft : a.offsetTop - b.offsetTop)) // Reorders resizers in array to be correct index
        }

        this.children = [
            ...this.children.slice(0, insertIndex),
            {
                "widget": child,
                "size": size,
            },
            ...this.children.slice(insertIndex, this.children.length)
        ]

        if (!activeWidgets.includes(child)) activeWidgets.push(child)
        if (refresh) this.refresh()
    }
    removeChild(child, refresh = true) {
        let newChildren = []
        let size = 0
        for (let currentChild of this.children) {
            if (currentChild.widget !== child) newChildren.push(currentChild)
            else size = currentChild.size
        }
        this.children = newChildren
        let index = this.indexOfElement(child)
        if (index === -1) return
        this.el.removeChild(this.el.children[index]) // Remove element
        if (this.resizers.length) {
            let resizer = this.el.children[Math.min(index, this.el.children.length - 1)] // Remove resizer
            this.resizers.splice(this.resizers.indexOf(resizer), 1)
            this.el.removeChild(resizer)
        }

        child.parent = null

        activeWidgets.splice(activeWidgets.indexOf(child), 1)

        for (let x of this.children)
            x.size += size / this.children.length

        if (refresh) {
            main.refresh()
        }
    }
    replaceChild(oldChild, newChild) {
        this.el.children[this.indexOfElement(oldChild)].replaceWith(newChild.el)
        this.children[this.indexOf(oldChild)].widget = newChild
        newChild.parent = this
        activeWidgets.splice(activeWidgets.indexOf(oldChild), 1)
        activeWidgets.push(newChild)
    }
    indexOfElement(child) {
        return [].indexOf.call(this.el.children, child.el)
    }
    indexOf(child) {
        for (let i in this.children)
            if (this.children[i].widget === child) return parseInt(i)
        return -1
    }
    getDepthOf(child) {
        let depth = 0
        let parent = child.parent
        while (parent !== this) {
            try {
                parent = parent.parent
            } catch (e) {
                return -1 // Child is not a child of this group
            }
            depth++
        }
        return depth
    }
    includes(child) {
        for (let i of this.children) if (i.widget === child) return true
        return false
    }
    becomeOrphan(child) {
        this.removeChild(child)
    }
    refreshMinSizes() {
        this.minWidth = this.axis === "x" ? this.resizers.length * 6 : 0
        this.minHeight = this.axis === "y" ? this.resizers.length * 6 : 0
        for (let child of this.children) {
            if (this.axis === "x") {
                this.minWidth += child.widget.minWidth
                this.minHeight = Math.max(this.minHeight, child.widget.minHeight)
            }
            if (this.axis === "y") {
                this.minHeight += child.widget.minHeight
                this.minWidth = Math.max(this.minWidth, child.widget.minWidth)
            }
        }
    }

    get axis() {
        return this._axis
    }
    set axis(to) {
        this._axis = to
        this.el.classList.remove("x")
        this.el.classList.remove("y")
        if (to === "x") this.el.classList.add("x")
        if (to === "y") this.el.classList.add("y")
        this.refresh()
    }

    out() {
        let children = []
        for (let child of this.children) children.push({
            size: child.size,
            widget: child.widget.out()
        })
        return super.out({children, "axis": this.axis})
    }
    in(a) {
        let children = a["children"]
        for (let child of children) {
            let childWidget = new WidgetBase.WidgetTypes[child.widget.type]()
            childWidget.in(child.widget)
            console.log(child.widget.type, child.size)
            this.addChild(childWidget, child.size, undefined, false)
        }
        delete a["children"]
        super.in(a)
    }
}

class WidgetTabGroup extends WidgetBase {
    constructor() {
        super()
        this.children = []
        this._activeChild = 0

        this._name = "WidgetTabs"
        this.type = "tabs"

        this.header = {
            holder: document.createElement("div"),
            selectButtons: []
        }
        this.header.holder.className = "widget-header tabs"

        this.el.append(this.header.holder)

        this.content = document.createElement("div")
        this.content.className = "widget-content"
        this.el.appendChild(this.content)
    }
    refresh() {
        super.refresh()

        this.header.holder.style.width = this.width + "px"

        if (this.children.length)
            this.children[this.activeChild].setSize(this.width, this.height - (mobile ? 30 : 19))

        for (let i in this.header.selectButtons) {
            this.header.selectButtons[i].innerText = this.children[i].displayName()
            if (this.activeChild == i) this.header.selectButtons[i].classList.add("selected")
            else this.header.selectButtons[i].classList.remove("selected")
        }
    }
    hardRefresh() {
        super.hardRefresh();
        for (let child of this.children) child.hardRefresh()
        this.refresh()
    }
    addChild(child, insertIndex = this.children.length) {
        if (child.parent !== null) child.parent.removeChild(child)
        child.parent = this

        if (insertIndex === this.children.length) this.content.appendChild(child.el)
        else if (insertIndex === 0) this.content.prepend(child.el)
        else this.content.insertBefore(child.el, this.content.childNodes[insertIndex])

        this.children = [
            ...this.children.slice(0, insertIndex),
            child,
            ...this.children.slice(insertIndex, this.children.length)
        ]

        let tabSelectButton = document.createElement("div")
        tabSelectButton.className = "widget-tab"
        this.header.holder.appendChild(tabSelectButton)
        this.header.selectButtons.push(tabSelectButton)
        tabSelectButton.addEventListener("click", () => {
            this.activeChild = this.header.selectButtons.indexOf(tabSelectButton)
        })

        for (let i of this.children) i.el.classList.add("inactive-tab")
        this.activeChild = insertIndex
    }
    addChildren(...children) {
        for (let child of children) {
            if (child.parent !== null) child.parent.removeChild(child)
            child.parent = this

            this.content.appendChild(child.el)

            this.children.push(child)

            let tabSelectButton = document.createElement("div")
            tabSelectButton.className = "widget-tab"
            this.header.holder.appendChild(tabSelectButton)
            this.header.selectButtons.push(tabSelectButton)
            tabSelectButton.addEventListener("click", () => {
                this.activeChild = this.header.selectButtons.indexOf(tabSelectButton)
            })
        }
        this.activeChild = this.children.length - 1
    }
    removeChild(child) {
        let index = this.children.indexOf(child)
        if (index === -1) return

        if (activeWidgets.includes(child))
            activeWidgets.splice(activeWidgets.indexOf(child), 1)

        this.children.splice(index, 1)
        this.content.removeChild(this.content.children[index]) // Remove element

        this.header.selectButtons.splice(-1, 1)
        this.header.holder.childNodes[this.header.holder.childNodes.length - 1].remove()

        child.parent = null
        child.el.classList.remove("inactive-tab")

        this.activeChild = Math.max(this.children.length - 1, 0)
    }
    getDepthOf(child) {
        let depth = 0
        let parent = child.parent
        while (parent !== this) {
            try {
                parent = parent.parent
            } catch (e) {
                return -1 // Child is not a child of this group
            }
            depth++
        }
        return depth
    }
    includes(child) {
        for (let i of this.children) if (i.widget === child) return true
        return false
    }
    indexOf(child) {
        for (let i in this.children)
            if (this.children[i] === child) return parseInt(i)
        return -1
    }

    get activeChild() {
        return this._activeChild
    }
    set activeChild(to) {
        if (activeWidgets.includes(this.children[this.activeChild]))
            activeWidgets.splice(activeWidgets.indexOf(this.children[this.activeChild]), 1)

        if (this.children[this._activeChild] !== undefined) this.children[this.activeChild].el.classList.add("inactive-tab")

        if (this.children.length === 0) return // Being brutally murdered by parent :(

        this._activeChild = to
        activeWidgets.push(this.children[to])
        this.children[to].el.classList.remove("inactive-tab")
        this.refreshMinSizes()
        this.refresh()
    }

    refreshMinSizes() {
        this.minWidth = 150
        this.minHeight = 150
        for (let child of this.children) {
            this.minWidth = Math.max(this.minWidth, child.minWidth)
            this.minHeight = Math.max(this.minHeight, child.minHeight)
        }
        if (this.parent) this.parent.refresh()
    }

    out() {
        let children = []
        for (let child of this.children) children.push(child.out())
        return super.out({children, activeChild: this.activeChild})
    }
    in(a) {
        let children = a["children"]
        for (let child of children) {
            let childWidget = new WidgetBase.WidgetTypes[child.type]()
            childWidget.in(child)
            this.addChild(childWidget)
        }
        delete a["children"]
        super.in(a)
    }
}

class Widget extends WidgetBase {
    constructor() {
        super()

        this.type = "widget"

        //#region Widget header
        this._header = {
            holder: document.createElement("div"),
            name: document.createElement("div"),
            dragger: document.createElement("div"),
            remover: document.createElement("div"),
        }
        this._header.holder.className = "widget-header"

        // Widget Removal
        this._header.remover.className = "material-symbols-outlined widget-remove"
        this._header.remover.innerText = "close"
        this._header.remover.addEventListener("mouseup", () => {
            if (activeWidgets.length > 1) this.parent.removeChild(this)
        })
        this._header.remover.addEventListener("touchend", () => {
            if (activeWidgets.length > 1) this.parent.removeChild(this)
        })
        this._header.holder.appendChild(this._header.remover)

        //#region Widget Dragging
        this._header.dragger.className = "material-symbols-outlined widget-drag"
        this._header.dragger.innerText = "drag_indicator"
        this._header.holder.appendChild(this._header.dragger)

        let isDragging = false

        /**
         * @return "{widget, axis, dragPos, tabGroup}", "null"
         */
        function getDraggingWidget(x,y) {
            for (let widget of activeWidgets) {
                if (widget === this) continue
                if (widget.type === "group") continue
                if (widget.parent.type === "tabs") continue

                let bound = widget.el.getBoundingClientRect()
                if (bound.top < y && bound.top - y > (-topDragSize * (15 / 11)) && x > bound.left && x < bound.right) { // Top
                    if (bound.top - y > -headerSize) {
                        if (widget.type === "tabs") {
                            return {widget, "tabGroup": "add"}
                        } else {
                            return {widget, "tabGroup": "new"}
                        }
                    } else if (widget.parent.type !== "tabs") return {widget, "axis": "y", "dragPos": "before"}
                    break
                }
                else if (bound.right > x && bound.right - x < sideDragSize && y > bound.top && y < bound.bottom) {
                    return {widget, "axis": "x", "dragPos": "after"}
                }
                else if (bound.left < x && bound.left - x > -sideDragSize && y > bound.top && y < bound.bottom) {
                    return {widget, "axis": "x", "dragPos": "before"}
                }
                else if (bound.bottom > y && bound.bottom - y < sideDragSize && x > bound.left && x < bound.right) {
                    return {widget, "axis": "y", "dragPos": "after"}
                }

                // fixme Dragging an adjacent widget above or below another causes issues
            }
            return null
        }

        addDownEvent(this._header.dragger, () => {
            isDragging = true
            this._header.dragger.classList.add("dragging")
        })
        addMoveEvent((e) => {
            if (!isDragging) return
            this._header.dragger.style.left = Math.clamp(e.clientX - (this._header.dragger.offsetWidth / 2), 0,window.innerWidth - this._header.dragger.offsetWidth) + "px"
            this._header.dragger.style.top = Math.clamp(e.clientY - (this._header.dragger.offsetHeight / 2), 0, window.innerHeight - this._header.dragger.offsetHeight - 8) + "px"

            let currentDrag = getDraggingWidget(e.clientX, e.clientY)

            if (currentDrag !== null) {
                widgetDragPreview.classList.remove("hidden")

                let el = currentDrag.widget.el

                console.log(currentDrag)

                if (currentDrag.tabGroup === undefined) {
                    let width, height
                    widgetDragPreview.style.width = (width = currentDrag.axis === "y" ? el.offsetWidth : sideDragSize) + "px"
                    widgetDragPreview.style.height = (height = currentDrag.axis === "x" ? el.offsetHeight : sideDragSize) + "px"

                    if (currentDrag.axis === "x" && currentDrag.dragPos === "before") {
                        widgetDragPreview.style.left = el.offsetLeft + "px"
                        widgetDragPreview.style.top = el.offsetTop + "px"
                    }
                    if (currentDrag.axis === "x" && currentDrag.dragPos === "after") {
                        widgetDragPreview.style.left = el.offsetLeft + el.offsetWidth - width + "px"
                        widgetDragPreview.style.top = el.offsetTop + "px"
                    }
                    if (currentDrag.axis === "y" && currentDrag.dragPos === "before") {
                        widgetDragPreview.style.left = el.offsetLeft + "px"
                        widgetDragPreview.style.top = el.offsetTop + "px"
                    }
                    if (currentDrag.axis === "y" && currentDrag.dragPos === "after") {
                        widgetDragPreview.style.left = el.offsetLeft + "px"
                        widgetDragPreview.style.top = el.offsetTop + el.offsetHeight - height + "px"
                    }
                } else {
                    widgetDragPreview.style.width = el.offsetWidth + "px"
                    widgetDragPreview.style.height = headerSize + "px"

                    widgetDragPreview.style.left = (el.offsetLeft) + "px"
                    widgetDragPreview.style.top = el.offsetTop+"px"
                }

            } else widgetDragPreview.classList.add("hidden")
        })
        addCancelEvent(() => {
            isDragging = false
            this._header.dragger.classList.remove("dragging")

        })
        addUpEvent((e) => {
            if (!isDragging) return
            isDragging = false
            widgetDragPreview.classList.add("hidden")
            this._header.dragger.classList.remove("dragging")

            // TODO: replace with getDraggingWidget
            for (let widget of activeWidgets) {
                if (widget === this) continue
                if (widget.type === "group") continue
                if (widget.parent.type === "tabs") continue

                let bound = widget.el.getBoundingClientRect()
                if (bound.top < e.clientY && bound.top - e.clientY > -sideDragSize && e.clientX > bound.left && e.clientX < bound.right) { // Top
                    console.log(widget.parent.type, bound.top - e.clientY)
                    if (bound.top - e.clientY > -topDragSize * (15 / 11)) {
                        if (widget.type === "tabs") {
                            widget.addChild(this)
                        } else {
                            this.parent.removeChild(this)
                            let widgetParent = widget.parent
                            let group = new WidgetTabGroup()
                            widgetParent.replaceChild(widget, group)
                            group.addChildren(widget, this)
                            console.log(group)
                        }
                    } else if (widget.parent.type !== "tabs") completeDrag.call(this, widget, "y", "before")
                    break
                }
                else if (bound.right > e.clientX && bound.right - e.clientX < sideDragSize && e.clientY > bound.top && e.clientY < bound.bottom) {
                    completeDrag.call(this, widget, "x", "after")
                    break
                }
                else if (bound.left < e.clientX && bound.left - e.clientX > -sideDragSize && e.clientY > bound.top && e.clientY < bound.bottom) {
                    completeDrag.call(this, widget, "x", "before")
                    break
                }
                else if (bound.bottom > e.clientY && bound.bottom - e.clientY < sideDragSize && e.clientX > bound.left && e.clientX < bound.right) {
                    completeDrag.call(this, widget, "y", "after")
                    break
                }

                // fixme Dragging an adjacent widget above or below another causes issues
            }

            function completeDrag(widget, axis, dragPos) {
                let widgetParent = widget.parent
                let group = new WidgetGroup()
                group.axis = axis

                if ((widget.type === "tabs" || widget.type === "groups") && this.parent === widget && this.parent.children.length === 2) {
                    console.log(widget.indexOf(this))
                    let sibling = this.parent.children[Math.abs(widget.indexOf(this) - 1)]
                    sibling.parent = null
                    sibling.el.classList.remove("inactive-tab")
                    this.parent = null
                    group.addChild(sibling, 0.5, dragPos === "after" ? 0 : 1, false)
                    group.addChild(this, 0.5, dragPos === "after" ? 1 : 0, false)
                    widgetParent.replaceChild(widget, group)
                } else {
                    this.parent.removeChild(this)
                    widgetParent.replaceChild(widget, group)
                    group.addChild(widget, 0.5, dragPos === "after" ? 0 : 1, false)
                    group.addChild(this, 0.5, dragPos === "after" ? 1 : 0, false)
                }
            }

            main.refresh()
        })

        //#endregion

        this._header.holder.appendChild(this._header.name)
        this.name = "Widget"

        //#endregion

        this.content = document.createElement("div")
        this.content.className = "widget-content-real"

        this.el.append(this._header.holder)
        this.el.appendChild(this.content)
    }

    addHeaderIcon(icon, title, dialog, callback, openOffset = [0,0]) {
        let el = document.createElement("div")
        el.className = "material-symbols-outlined widget-header-icon"
        el.innerText = icon
        el.title = title

        el.addEventListener("click", (e) => {
            dialog.style.left = (e.clientX + openOffset[0]) + "px"
            dialog.style.top = (e.clientY + openOffset[1]) + "px"
            dialog.show()
            callback.call(this)
        })
        document.addEventListener("mousedown", (e) => {
            if (!dialog.contains(e.target) && !e.target.classList.contains("widget-header-icon")) dialog.close()
        })

        this._header.name.insertAdjacentElement('beforebegin', el)
    }

    get name() {
        return this._name
    }
    set name(to) {
        super.name = to
        this._header.name.innerText = this.displayName()
        if (this.parent) this.parent.refresh()
    }

    displayName() {
        if (this._name.length > 40) return this._name.substring(0, 15) + " ... " + this.name.substring(this._name.length - 15)
        return this._name
    }

    refresh() {
        super.refresh();
        this.content.style.width = (this.w) + "px"
        this.content.style.height = (this.h - this._header.holder.offsetHeight) + "px"
    }
}
//#endregion

/**
 * @param rem
 * @returns {number} Pixel rem size
 */
function getRem(rem = 1) {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

//#region Init

let mobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
if (mobile) document.documentElement.classList.add("mobile")

let headerSize = mobile ? 34 : 22
let topDragSize = mobile ? 40 : 30
let sideDragSize = mobile ? 60 : 30

let widgetDragPreview = document.createElement("div")
widgetDragPreview.className = "widget-drag-preview"
document.body.appendChild(widgetDragPreview)

let activeWidgets = []
let uniqueIds = [] // Documents widget ids that have been used

let main = new WidgetGroup()
main.name = "main"
document.querySelector(".content").appendChild(main.el)

window.addEventListener("resize", () => {
    main.width = window.innerWidth
    main.height = window.innerHeight - document.querySelector(".sticky-header").offsetHeight - document.querySelector("footer").offsetHeight - 4
})
main.width = window.innerWidth
main.height = window.innerHeight - document.querySelector(".sticky-header").offsetHeight - document.querySelector("footer").offsetHeight - 4

//#endregion

// Required for Widget loading
setTimeout(() => {
    WidgetBase.WidgetTypes["base"] = WidgetBase
    WidgetBase.WidgetTypes["group"] = WidgetGroup
    WidgetBase.WidgetTypes["tabs"] = WidgetTabGroup
    WidgetBase.WidgetTypes["table"] = Table
    WidgetBase.WidgetTypes["graph"] = Graph
    WidgetBase.WidgetTypes["info"] = TeamInfo
    WidgetBase.WidgetTypes["media"] = TeamMedia
    WidgetBase.WidgetTypes["comments"] = Comments
    WidgetBase.WidgetTypes["matches"] = Matches
}, 0)
