package controllers

import (
	"fmt"
	"os/exec"

	"github.com/astaxie/beego"
)

type MainController struct {
	beego.Controller
}

func (c *MainController) Get() {
	c.TplName = "index.html"
}

func (c *MainController) Post() {
	stdout, err := exec.Command("static/py/get-panw-firewalls.py", "--raw-output").Output()
	if err != nil {
		fmt.Println(err)
	}
	
	c.Ctx.ResponseWriter.Write(stdout)
}
