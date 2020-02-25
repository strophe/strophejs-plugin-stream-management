# FIXME copied from Strophe many things are not working
CHROMIUM		?= ./node_modules/.bin/run-headless-chromium
HTTPSERVE		?= ./node_modules/.bin/http-server
HTTPSERVE_PORT  ?= 8080
ESLINT		  	?= ./node_modules/.bin/eslint
NDPROJ_DIR 		= ndproj
SED				?= sed
SHELL			?= /usr/env/bin/bash
SRC_DIR			= src

.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of the following:"
	@echo ""
	@echo " serve       Build and run the tests"
	@echo " eslint      Check code quality"
	@echo " stamp-npm   Install NPM dependencies and create the guard file stamp-npm which will prevent those dependencies from being installed again."
	@echo ""

stamp-npm: package.json
	npm install

.PHONY: check
check: stamp-npm
	LOG_CR_VERBOSITY=INFO $(CHROMIUM) --no-sandbox http://localhost:$(HTTPSERVE_PORT)/tests/

.PHONY: serve
serve:
	$(HTTPSERVE) -c-1 -p $(HTTPSERVE_PORT) -a localhost

.PHONY: clean
clean:
	@@rm -f stamp-npm
	@@rm -rf node_modules
	@@rm -rf lib
	@@echo "Done."
	@@echo
