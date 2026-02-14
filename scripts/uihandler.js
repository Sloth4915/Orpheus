'use strict';

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
    set scope(to) {
        this._scope = to
        this.refresh()
    }
    get scope() {
        return this._scope
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
            if (++ascii == 122) id = id + Math.round(Math.random() * 26) + 65
        }
        id = "" + (id + String.fromCharCode(ascii))

        uniqueIds.push(id)
        return id
    }

    toString() {
        return this.name
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

        let resizerSize = this.resizers.length * 4

        let tooSmall = []
        let shrinkRequired = 0

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
            resizer.addEventListener("mousedown", (e) => {
                moving = true
                e.preventDefault()
            })
            document.body.addEventListener("mousemove", (e) => {
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
            document.body.addEventListener("mouseup", mouseUp)
            document.body.addEventListener("mouseleave", mouseUp)

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
            this.children[this.activeChild].setSize(this.width, this.height - 19)

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
    becomeOrphan(child) {
        this.removeChild(child)
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
                if (bound.top < y && bound.top - y > -30 && x > bound.left && x < bound.right) { // Top
                    if (bound.top - y > -22) {
                        if (widget.type === "tabs") {
                            return {widget, "tabGroup": "add"}
                        } else {
                            return {widget, "tabGroup": "new"}
                        }
                    } else if (widget.parent.type !== "tabs") return {widget, "axis": "y", "dragPos": "before"}
                    break
                }
                else if (bound.right > x && bound.right - x < 30 && y > bound.top && y < bound.bottom) {
                    return {widget, "axis": "x", "dragPos": "after"}
                }
                else if (bound.left < x && bound.left - x > -30 && y > bound.top && y < bound.bottom) {
                    return {widget, "axis": "x", "dragPos": "before"}
                }
                else if (bound.bottom > y && bound.bottom - y < 30 && x > bound.left && x < bound.right) {
                    return {widget, "axis": "y", "dragPos": "after"}
                }

                // fixme Dragging an adjacent widget above or below another causes issues
            }
            return null
        }

        this._header.dragger.addEventListener("mousedown", () => {
            isDragging = true
            this._header.dragger.classList.add("dragging")
        })
        document.body.addEventListener("mousemove", (e) => {
            if (!isDragging) return
            this._header.dragger.style.left = Math.clamp(e.clientX - (this._header.dragger.offsetWidth / 2), 0,window.innerWidth - this._header.dragger.offsetWidth) + "px"
            this._header.dragger.style.top = Math.clamp(e.clientY - (this._header.dragger.offsetHeight / 2), 0, window.innerHeight - this._header.dragger.offsetHeight - 8) + "px"

            let currentDrag = getDraggingWidget(e.clientX, e.clientY)

            if (currentDrag !== null) {
                widgetDragPreview.classList.remove("hidden")

                let el = currentDrag.widget.el

                if (currentDrag.tabGroup === undefined) {
                    let width, height
                    widgetDragPreview.style.width = (width = currentDrag.axis === "y" ? el.offsetWidth : 30) + "px"
                    widgetDragPreview.style.height = (height = currentDrag.axis === "x" ? el.offsetHeight : 30) + "px"

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
                    widgetDragPreview.style.height = "23px"

                    widgetDragPreview.style.left = (el.offsetLeft) + "px"
                    widgetDragPreview.style.top = el.offsetTop+"px"
                }

            } else widgetDragPreview.classList.add("hidden")
        })
        document.body.addEventListener("mouseleave", () => {
            isDragging = false
            this._header.dragger.classList.remove("dragging")
        })
        document.body.addEventListener("mouseup", (e) => {
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
                if (bound.top < e.clientY && bound.top - e.clientY > -30 && e.clientX > bound.left && e.clientX < bound.right) { // Top
                    console.log(widget.parent.type, bound.top - e.clientY)
                    if (bound.top - e.clientY > -22) {
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
                else if (bound.right > e.clientX && bound.right - e.clientX < 30 && e.clientY > bound.top && e.clientY < bound.bottom) {
                    completeDrag.call(this, widget, "x", "after")
                    break
                }
                else if (bound.left < e.clientX && bound.left - e.clientX > -30 && e.clientY > bound.top && e.clientY < bound.bottom) {
                    completeDrag.call(this, widget, "x", "before")
                    break
                }
                else if (bound.bottom > e.clientY && bound.bottom - e.clientY < 30 && e.clientX > bound.left && e.clientX < bound.right) {
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

    addHeaderIcon(icon, title, dialog, callback) {
        let el = document.createElement("div")
        el.className = "material-symbols-outlined widget-header-icon"
        el.innerText = icon
        el.title = title

        el.addEventListener("click", (e) => {
            dialog.style.top = e.clientY + "px"
            dialog.style.left = e.clientX + "px"
            dialog.show()
            callback.call(this)
        })
        document.addEventListener("click", (e) => {
            if (!dialog.contains(e.target) && e.target !== el) dialog.close()
        })

        this._header.dragger.insertAdjacentElement('afterend', el)
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

// Todo add popup widget holder for things like notebook

class Color extends Widget {
    constructor(c) {
        super()
        this.name = c
        this.content.style.backgroundColor = c
    }
    refresh() {
        super.refresh();
    }
}

/**
 * @param rem
 * @returns {number} Pixel rem size
 */
function getRem(rem = 1) {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

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
    main.height = window.innerHeight - document.querySelector(".sticky-header").offsetHeight - document.querySelector("footer").offsetHeight
})
main.width = window.innerWidth
main.height = window.innerHeight - document.querySelector(".sticky-header").offsetHeight - document.querySelector("footer").offsetHeight

/**
let red = new Color("darkred")
main.addChild(red, 0.25)

let sub = new WidgetGroup()
sub.axis = "y"
sub.name = "sub"
main.addChild(sub)

sub.addChild(new Color("rebeccapurple"), 0.5)
sub.addChild(new Color("lightgreen"), 0.5)

let sub3 = new WidgetGroup()
sub.addChild(sub3)
sub3.addChild(new Color("var(--bg)"), 0.5)
sub3.addChild(new Color("plum"), 0.5)

let sub2 = new WidgetTabGroup()
sub.addChild(sub2)

sub2.addChildren(new Color("darkblue"), new Color("cadetblue"))
sub2.addChild(new Color("olivedrab"))
let mpurp = new Color("mediumpurple")
sub2.addChild(mpurp, 0)

main.addChild(new Color("gold"))
 */
