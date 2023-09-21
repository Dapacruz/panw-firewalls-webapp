package controllers

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"

	"github.com/astaxie/beego"
)

type RunCommand struct {
	beego.Controller
}

type RunCommandRequest struct {
	Username  string `form:"username"`
	Password  string `form:"password"`
	Commands  string `form:"commands"`
	Firewalls string `form:"firewalls"`
}

func (c *RunCommand) Post() {
	request := RunCommandRequest{}
	if err := c.ParseForm(&request); err != nil {
		fmt.Println(err)
	}

	firewalls := strings.Split(request.Firewalls, ",")
	args := []string{"firewall", "run", "commands", "-K", "-t", "40", "--user", request.Username, "--password", request.Password, "--command"}
	args = append(args, request.Commands)
	args = append(args, firewalls...)

	// fmt.Printf("Password: %v\n", request.Password)

	cmd := exec.Command("static/go/panos-cli", args...)
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
