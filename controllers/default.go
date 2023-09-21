package controllers

import (
	"bytes"
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
	cmd := exec.Command("static/py/get-panw-firewalls.py", "--raw-output")
	var outb, errb bytes.Buffer
	cmd.Stdout = &outb
	cmd.Stderr = &errb
	err := cmd.Run()
	if err != nil {
		fmt.Println(errb.String())
		c.CustomAbort(500, errb.String())
	}

	c.Ctx.ResponseWriter.Write([]byte(outb.String()))
}
