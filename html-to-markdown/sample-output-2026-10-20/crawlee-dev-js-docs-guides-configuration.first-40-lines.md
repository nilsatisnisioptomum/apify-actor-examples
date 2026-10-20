---
title: "Configuration | Crawlee for JavaScript · Build reliable crawlers. Fast."
source: "https://crawlee.dev/js/docs/guides/configuration"
characters: 11682
---

# Configuration | Crawlee for JavaScript · Build reliable crawlers. Fast.

Configuring Crawlee parameters

Source: https://crawlee.dev/js/docs/guides/configuration

Version: 3.18# Configuration

​[`Configuration`](/js/api/core/class/Configuration) is a class holding Crawlee configuration parameters. By default, you don't need to set or change any of them, but for certain use cases you might want to do so, e.g. in order to change the default storage directory, or enable verbose error logging, and so on.

There are three ways of changing the configuration parameters:

- adding
  
  crawlee.jsonfile to your project
- setting environment variables
- using the
  
  Configurationclass

You could also combine all the above, but you should keep in mind, that the precedence for these 3 options is the following: ***`crawlee.json`*** < ***constructor options*** < ***environment variables***.

`crawlee.json` is a baseline. The options provided in the `Configuration` constructor will override the options provided in the JSON. Environment variables will override both.

## `crawlee.json`[​](#crawleejson)

The first option you could use for configuring Crawlee is `crawlee.json` file. The only thing you need to do is specify the [`ConfigurationOptions`](/js/api/core/interface/ConfigurationOptions) in the file, place the file in the root of your project, and Crawlee will use provided options as global configuration.

crawlee.json

```
{  "persistStateIntervalMillis": 10000,  "logLevel": "DEBUG"}
```

