package controllers

import (
	"os/exec"
	"fmt"
	"bytes"
	"log"

	"github.com/astaxie/beego"
)

type RunCommand struct {
	beego.Controller
}

type RunCommandRequest struct {
	Username string `form:"username"`
	Password string `form:"password"`
	Command string `form:"command"`
	Firewalls string `form:"firewalls"`
}

func (c *RunCommand) Post() {
	request := RunCommandRequest{}
    if err := c.ParseForm(&request); err != nil {
		fmt.Println(err)
	}

	cmd := exec.Command("static/py/run-panw-cmd.py","--user", request.Username, "--password", request.Password, "--command", request.Command, request.Firewalls)
	var outb, errb bytes.Buffer
	cmd.Stdout = &outb
	cmd.Stderr = &errb
	err := cmd.Run()
	if err != nil {
		log.Fatal(err)
	}

	// fmt.Println("out:", outb.String(), "err:", errb.String())
	
	c.Ctx.ResponseWriter.Write([]byte(outb.String()))
}
