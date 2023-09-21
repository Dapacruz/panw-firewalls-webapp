package controllers

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"

	"github.com/astaxie/beego"
)

type GetApiKey struct {
	beego.Controller
}

type GetApiKeyRequest struct {
	Panorama string `form:"panorama"`
	Username string `form:"username"`
	Password string `form:"password"`
}

func (c *GetApiKey) Post() {
	request := GetApiKeyRequest{}
	if err := c.ParseForm(&request); err != nil {
		fmt.Println(err)
		c.CustomAbort(500, err.Error())
	}

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: tr}

	url := fmt.Sprintf("https://%s/api/", request.Panorama)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println(err)
		c.CustomAbort(500, err.Error())
	}

	q := req.URL.Query()
	q.Add("type", "keygen")
	q.Add("user", request.Username)
	q.Add("password", request.Password)

	req.URL.RawQuery = q.Encode()

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(err)
		c.CustomAbort(500, err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Println(resp.Status)
		c.CustomAbort(resp.StatusCode, resp.Status)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println(err)
		c.CustomAbort(500, err.Error())
	}

	c.Ctx.ResponseWriter.Write(respBody)
}
