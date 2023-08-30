package main

import (
	"github.com/astaxie/beego"
	_ "firewalls/routers"
)

func main() {
	beego.Run()
}
