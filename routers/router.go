package routers

import (
	"firewalls/controllers"

	"github.com/astaxie/beego"
)

func init() {
	beego.SetStaticPath("/static/fonts", "static/fonts")
	beego.Router("/", &controllers.MainController{})
	beego.Router("/get/interfaces", &controllers.GetInterfaces{})
	beego.Router("/get/config", &controllers.GetConfig{})
	beego.Router("/run/command", &controllers.RunCommand{})
	beego.Router("/get/tags", &controllers.GetTags{})
	beego.Router("/get/apikey", &controllers.GetApiKey{})
}
