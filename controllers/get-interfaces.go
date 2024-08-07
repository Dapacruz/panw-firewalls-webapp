package controllers

import (
	"bytes"
	"fmt"
	"os/exec"

	"github.com/astaxie/beego"
)

type GetInterfaces struct {
	beego.Controller
}

type GetInterfacesRequest struct {
	Key       string `form:"key"`
	Firewalls string `form:"firewalls"`
}

func (c *GetInterfaces) Post() {
	request := GetInterfacesRequest{}
	if err := c.ParseForm(&request); err != nil {
		fmt.Println(err)
	}

	cmd := exec.Command("static/py/get-panw-interfaces.py", "--key", request.Key, request.Firewalls)
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
