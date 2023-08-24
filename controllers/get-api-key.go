package controllers

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"log"
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
	}

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: tr}

	url := fmt.Sprintf("https://%s/api/", request.Panorama)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println(err)
		panic(err)
	}

	q := req.URL.Query()
	q.Add("type", "keygen")
	q.Add("user", base64.StdEncoding.EncodeToString([]byte(request.Username)))
	q.Add("password", base64.StdEncoding.EncodeToString([]byte(request.Password)))

	req.URL.RawQuery = q.Encode()

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Println(err)
		log.Fatal(resp.Status)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println(err)
		panic(err)
	}

	c.Ctx.ResponseWriter.Write(respBody)
}
