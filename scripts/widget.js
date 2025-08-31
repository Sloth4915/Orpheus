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

    refresh() {
        this.el.style.width = this.w + "px"
        this.el.style.height = this.h + "px"
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

            if (child.widget.type === "group" && child.widget.axis === this.axis) {
                let index = this.indexOf(child.widget)
                for (let grandchild of child.widget.children) {
                    this.addChild(grandchild.widget, grandchild.size * child.size, index, false)
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
    }
    addChild(child, size = "unset", insertIndex = this.children.length, refresh = true) {
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
            x.size /= (1 - size)

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

class Widget extends WidgetBase {
    constructor() {
        super()

        this.type = "widget"

        this.settings = {}

        //#region Widget header
        this.header = {
            holder: document.createElement("div"),
            name: document.createElement("div"),
            dragger: document.createElement("div"),
            remover: document.createElement("div")
        }
        this.header.holder.className = "widget-header"

        // Widget Removal
        this.header.remover.className = "material-symbols-outlined widget-remove"
        this.header.remover.innerText = "close"
        this.header.remover.addEventListener("mouseup", () => {
            this.parent.removeChild(this)
        })
        this.header.holder.appendChild(this.header.remover)

        // Widget Dragging
        this.header.dragger.className = "material-symbols-outlined widget-drag"
        this.header.dragger.innerText = "drag_indicator"
        this.header.holder.appendChild(this.header.dragger)

        let isDragging = false

        this.header.dragger.addEventListener("mousedown", () => {
            isDragging = true
            this.header.dragger.classList.add("dragging")
        })
        document.body.addEventListener("mousemove", (e) => {
            if (!isDragging) return
            this.header.dragger.style.left = e.clientX - (this.header.dragger.offsetWidth / 2) + "px"
            this.header.dragger.style.top = e.clientY - (this.header.dragger.offsetHeight / 2) + "px"
        })
        document.body.addEventListener("mouseleave", () => {
            isDragging = false
            this.header.dragger.classList.remove("dragging")
        })
        document.body.addEventListener("mouseup", (e) => {
            if (!isDragging) return
            isDragging = false
            this.header.dragger.classList.remove("dragging")

            for (let widget of activeWidgets) {
                if (widget === this) continue
                if (widget.type === "group") continue
                let bound = widget.el.getBoundingClientRect()
                if (bound.right > e.clientX && bound.right - e.clientX < 30 && e.clientY > bound.top && e.clientY < bound.bottom) {
                    completeDrag.call(this, widget, "x", "after")
                    break
                }
                if (bound.left < e.clientX && bound.left - e.clientX > -30 && e.clientY > bound.top && e.clientY < bound.bottom) {
                    completeDrag.call(this, widget, "x", "before")
                    break
                }
                if (bound.bottom > e.clientY && bound.bottom - e.clientY < 30 && e.clientX > bound.left && e.clientX < bound.right) {
                    completeDrag.call(this, widget, "y", "after")
                    break
                }
                if (bound.top < e.clientY && bound.top - e.clientY > -30 && e.clientX > bound.left && e.clientX < bound.right)  {
                    completeDrag.call(this, widget, "y", "before")
                    break
                }
            }

            function completeDrag(widget, axis, dragPos) {
                let widgetParent = widget.parent
                let group = new WidgetGroup()
                group.axis = axis
                widgetParent.replaceChild(widget, group)
                group.addChild(widget, 0.5, dragPos === "after" ? 0 : 1, false)
                group.addChild(this, 0.5, dragPos === "after" ? 1 : 0, false)
            }

            main.refresh()
        })

        this.header.holder.appendChild(this.header.name)
        this.name = "Widget"

        this.el.append(this.header.holder)
        //#endregion
    }

    set name(to) {
        super.name = to
        this.header.name.innerText = this._name
    }
}

// Todo add popup widget holder for things like notebook

class Color extends Widget {
    constructor(c) {
        super()
        this.el.style.backgroundColor = c
        this.name = c
    }
    refresh() {
        super.refresh();
    }
}

let activeWidgets = []

let main = new WidgetGroup()
main.name = "main"
document.querySelector(".content").appendChild(main.el)

window.addEventListener("resize", () => {
    main.width = window.innerWidth
    main.height = window.innerHeight - 100
})
main.width = window.innerWidth
main.height = window.innerHeight - 100

let red = new Color("darkred")
main.addChild(red, 0.25)

let sub = new WidgetGroup()
sub.axis = "y"
sub.name = "sub"
main.addChild(sub)

sub.addChild(new Color("rebeccapurple"), 0.5)
sub.addChild(new Color("lightgreen"), 0.5)
/*
let sub3 = new WidgetGroup()
sub.addChild(sub3)
sub3.addChild(new Color("var(--bg)"), 0.5)
sub3.addChild(new Color("plum"), 0.5)*/

let sub2 = new WidgetGroup()
sub2.axis = "x"
sub.addChild(sub2)

sub2.addChild(new Color("darkblue"), 0.2)
let salmon = new Color("salmon")
sub2.addChild(salmon, 0.3)
sub2.addChild(new Color("cadetblue"), 0.1)
sub2.addChild(new Color("olivedrab"))
sub2.addChild(new Color("mediumpurple"), 0.1, 0)

main.addChild(new Color("gold"))
