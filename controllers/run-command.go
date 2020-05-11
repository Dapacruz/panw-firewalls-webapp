package controllers

import (
	"os/exec"
	"fmt"
	"bytes"
	"log"
	"strings"

	"github.com/astaxie/beego"
)

type RunCommand struct {
	beego.Controller
}

type RunCommandRequest struct {
	Username string `form:"username"`
	Password string `form:"password"`
	Commands string `form:"commands"`
	Firewalls string `form:"firewalls"`
}

func (c *RunCommand) Post() {
	request := RunCommandRequest{}
    if err := c.ParseForm(&request); err != nil {
		fmt.Println(err)
	}

	cmds := strings.Split(request.Commands, ",")
	args := []string{"--user", request.Username, "--password", request.Password}
	args = append(args, cmds...)
	args = append(args, request.Firewalls)

	// fmt.Printf("Password: %v\n", request.Password)

	cmd := exec.Command("static/py/run-panw-cmd.py", args...)
	var outb, errb bytes.Buffer
	cmd.Stdout = &outb
	cmd.Stderr = &errb
	err := cmd.Run()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("out:", outb.String(), "err:", errb.String())
	
	c.Ctx.ResponseWriter.Write([]byte(outb.String()))
}
