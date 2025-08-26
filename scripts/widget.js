class Widget {
    constructor() {
        this._scope = "" // This will eventually be stuff like starred teams, a list of teams, all teams, one specific team, etc.
        this.w = 0
        this.h = 0
        this.el = document.createElement("div")
        this.el.className = "widget"

        this.minWidth = 100
        this.minHeight = 100
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

    canBeShrunkMore(axis) {
        if (axis === "x") return Math.ceil(this.width) + 0.1 > this.minWidth
        if (axis === "y") return Math.ceil(this.height) + 0.1 > this.minHeight
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

class WidgetGroup extends Widget {
    // Widget axis: x means that size impacts the width of the child widgets, and y impacts the height of the child widgets.

    constructor() {
        super()
        this.children = []
        this.resizers = []
        this.el.className = "widget-holder"
        this.axis = "x"
    }
    refresh() {
        this.refreshMinSizes()

        super.refresh()

        let resizerSize = this.resizers.length * 6

        let tooSmall = []
        let shrinkRequired = 0

        for (let child of this.children) {
            if (this.axis === "x") child.widget.setSize(child.size * (this.width - resizerSize), this.height)
            if (this.axis === "y") child.widget.setSize(this.width, child.size * (this.height - resizerSize))
            if (!child.widget.canBeShrunkMore(this.axis)) { // Group has shrunk this widget to less than its intended size.
                tooSmall.push(child)

                let childSize = child.size
                let minSize = (this.axis === "x" ? child.widget.minWidth : child.widget.minHeight) / (this.axis ? this.width : this.height)

                shrinkRequired += minSize - childSize

                child.size = minSize
            }
        }

        if (tooSmall.length > 0) {
            for (let child of this.children) {
                if (tooSmall.includes(child)) {
                    continue
                }
                child.size -= shrinkRequired / (this.children.length - tooSmall.length)
                this.refresh()
            }
        }

        /*let totalSize = 0
        for (let x of this.children)
            totalSize += x.size

        if (totalSize >= 1) {
            for (let x of this.children)
                x.size /= totalSize
        }*/
    }
    addChild(child, size = "unset") {
        let totalSize = 0
        for (let x of this.children)
            totalSize += x.size

        if (totalSize >= 1) {
            if (size === "unset") size = 0.3
            for (let x of this.children)
                x.size *= (1-size)
        } else if (size === "unset") size = 1 - totalSize

        if (this.children.length) { // If already at least 1 child, add a resizer
            let resizer = document.createElement("div")
            resizer.className = "resizer"

            let index = this.children.length - 1

            let moving = false
            resizer.addEventListener("mousedown", (e) => {
                moving = true
                e.preventDefault()
            })
            document.body.addEventListener("mousemove", (e) => {
                let widget1 = this.children[index]
                let widget2 = this.children[index + 1]
                if (moving) {
                    if (widget1.size * (this.axis === "x" ? this.width : this.height) + (this.axis === "x" ? e.movementX : e.movementY) > (this.axis === "x" ? widget1.widget.minWidth : widget1.widget.minHeight) &&
                        widget2.size * (this.axis === "x" ? this.width: this.height) - (this.axis === "x" ? e.movementX : e.movementY) > (this.axis === "x" ? widget2.widget.minWidth : widget2.widget.minHeight))
                    {
                        widget1.size += this.axis === "x" ? (e.movementX / this.width) : (e.movementY / this.height)
                        widget2.size -= this.axis === "x" ? (e.movementX / this.width) : (e.movementY / this.height)
                    }
                    this.refresh()
                   // console.log(widget1.widget.color, widget2.widget.color)
                }
            })
            document.body.addEventListener("mouseup", (e) => {
                if (moving) {
                    moving = false

                    let widget1 = this.children[index]
                    let widget2 = this.children[index + 1]
                    widget1.size = Math.max((this.axis === "x" ? widget1.widget.minWidth + 1 : widget1.widget.minHeight + 1) / (this.axis === "x" ? this.width : this.height), widget1.size)
                    widget2.size = Math.max((this.axis === "x" ? widget2.widget.minWidth + 1 : widget2.widget.minHeight + 1) / (this.axis === "x" ? this.width : this.height), widget2.size)
                }
            })

            this.el.appendChild(resizer)
            this.resizers.push(resizer)
        }

        this.children.push({
            "widget": child,
            "size": size,
        })
        this.el.appendChild(child.el)

        this.refresh()
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

// Todo add popup widget holder for things like notebook

class Red extends Widget {
    constructor() {
        super()
        this.el.style.backgroundColor = "darkred"
        this.minWidth = 300
    }
}
class Green extends Widget {
    constructor() {
        super()
        this.el.style.backgroundColor = "green"
    }
}
class Purple extends Widget {
    constructor() {
        super()
        this.el.style.backgroundColor = "purple"
    }
}
class Color extends Widget {
    constructor(c) {
        super()
        this.color = c
        this.el.style.backgroundColor = c
        this.minHeight = 200
    }
    refresh() {
        super.refresh();
    }
}

let main = new WidgetGroup()
document.querySelector(".content").appendChild(main.el)

window.addEventListener("resize", () => {
    main.width = window.innerWidth
    main.height = window.innerHeight - 100
})
main.width = window.innerWidth
main.height = window.innerHeight - 100

main.addChild(new Red(), 0.25)

let sub = new WidgetGroup()
sub.axis = "y"
main.addChild(sub)

sub.addChild(new Green(), 0.5)
sub.addChild(new Purple())

let sub2 = new WidgetGroup()
sub2.axis = "x"
sub.addChild(sub2)

sub2.addChild(new Color("darkblue"), 0.4)
sub2.addChild(new Color("salmon"), 0.3)
sub2.addChild(new Color("mediumpurple"), 0.1)
sub2.addChild(new Color("olivedrab"))
