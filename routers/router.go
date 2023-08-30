package routers

import (
	"firewalls/controllers"
	"github.com/astaxie/beego"
)

func init() {
	beego.SetStaticPath("/static/fonts","static/fonts")
    beego.Router("/", &controllers.MainController{})
    beego.Router("/get/interfaces", &controllers.GetInterfaces{})
    beego.Router("/run/command", &controllers.RunCommand{})
}
