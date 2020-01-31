package controllers

import (
	"fmt"
	"os/exec"

	"github.com/astaxie/beego"
)

type GetTags struct {
	beego.Controller
}

func (c *GetTags) Post() {
	stdout, err := exec.Command("static/py/get-panw-tags.py").Output()
	if err != nil {
		fmt.Println(err)
	}
	
	c.Ctx.ResponseWriter.Write(stdout)
}
