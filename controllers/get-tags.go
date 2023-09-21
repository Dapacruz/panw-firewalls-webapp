package controllers

import (
	"bytes"
	"fmt"
	"os/exec"

	"github.com/astaxie/beego"
)

type GetTags struct {
	beego.Controller
}

func (c *GetTags) Post() {
	cmd := exec.Command("static/py/get-panw-tags.py")
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
