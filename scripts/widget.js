class Widget {
    constructor() {
        this._scope = "" // This will eventually be stuff like starred teams, a list of teams, all teams, one specific team, etc.
        this.w = 0
        this.h = 0
        this.el = document.createElement("div")
    }
    set scope(to) {
        this._scope = to
        this.refresh()
    }
    get scope() {
        return this._scope
    }

    set width(to) {
        this.w = to
        this.refresh()
    }
    get width() {
        return this.w
    }

    set height(to) {
        this.h = to
        this.refresh()
    }
    get height() {
        return this.h
    }

    setSize(width, height) {
        this.w = width
        this.h = height
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
        this.el.className = "widget-holder"
        this.axis = "x"
    }
    refresh() {
        super.refresh()
        for (let child of this.children) {
            if (this.axis === "x") child.widget.setSize(child.size * this.width, this.height)
            if (this.axis === "y") child.widget.setSize(this.width, child.size * this.height)
        }
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

        console.log(size)

        this.children.push({
            "widget": child,
            "size": size,
        })
        this.el.appendChild(child.el)
        this.refresh()
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
        this.el.style.backgroundColor = "red"
    }
}
class Blue extends Widget {
    constructor() {
        super()
        this.el.style.backgroundColor = "blue"
    }
}
class Purple extends Widget {
    constructor() {
        super()
        this.el.style.backgroundColor = "purple"
    }
}

let main = new WidgetGroup()
document.querySelector(".content").appendChild(main.el)

main.width = window.innerWidth
main.height = window.innerHeight

main.addChild(new Red(), 0.5)

let sub = new WidgetGroup()
sub.axis = "y"
main.addChild(sub)

sub.addChild(new Blue(), 0.5)
sub.addChild(new Purple())
