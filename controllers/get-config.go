package controllers

import (
	"os/exec"
	"fmt"
	"bytes"
	"log"

	"github.com/astaxie/beego"
)

type GetConfig struct {
	beego.Controller
}

type GetConfigRequest struct {
	Format string `form:"format"`
	Key string `form:"key"`
	Username string `form:"username"`
	Password string `form:"password"`
	Firewalls string `form:"firewalls"`
}

func (c *GetConfig) Post() {
	request := GetConfigRequest{}
    if err := c.ParseForm(&request); err != nil {
		fmt.Println(err)
	}

	var cmd *exec.Cmd
	if request.Format == "set" {
		cmd = exec.Command("static/py/get-panw-config.py", "--format", "set", "--user", request.Username, "--password", request.Password, request.Firewalls)
	} else {
		cmd = exec.Command("static/py/get-panw-config.py", "--format", "xml", "--key", request.Key, request.Firewalls)
	}
	var outb, errb bytes.Buffer
	cmd.Stdout = &outb
	cmd.Stderr = &errb
	err := cmd.Run()
	if err != nil {
		log.Fatal(err)
	}

	// fmt.Println("out:", out, "err:", errb.String())

	c.Ctx.ResponseWriter.Write([]byte(outb.String()))
}
