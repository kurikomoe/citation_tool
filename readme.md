# Description

Use electron as web browser to scrawl the Google scholar.

Features:

- Automatically get bibtex citation info from google scholar to get the full authors information as well as others

- Automatically perform next page click and stop when get all citation info.
- Automatically stop when recaptcha appears and handle the operation back to human.



# Usage

```bash
$ git clone https://github.com/kurikomoe/citation_tool.git
$ cd citation_tool
$ npm install
$ npm start
```

Then use `menu bar - kuriko functions - start | stop | pause| quit` to record data.

## Data

all data is stored in `db/scholar.json` 

> when perform scrawl multi-times, all data is stored as `key-value` pairs in `db/scholar.json`

# Screenshots

![image-20210115113908606](https://kurikomoe-1300672427.image.myqcloud.com/images/image-20210115113908606.png)

