My startpage

![example](example.gif)

# Features
- Custom search sources (google, brave, duckduckgo, wiki, imdb, google images, urbandictionary, goodreads, youtube, amazon, yahoo finance)
- Weather widget based on IP location
- Pastebin and media rehosting dropzone
- URL shortener dropzone
- Recent paste/rehost gallery
- dark/light mode

# Deployment
Deployment is handled automatically with [github actions](.github/workflows/deploy.yml) on each push to master. The commit short hash is taken and [appended](https://github.com/strong-code/strongcode-client/blob/master/.github/workflows/deploy.yml#L25) to `build.json` on the server, which can be seen along with the last commit message on the page.

# running locally

  $ ruby -run -e httpd dist/ -p 3001


# TODO
- google calendar integration
- css animations on submenu and search
- notes via db not localstorage
- robust logging and init script for server 
- sqlite backend
