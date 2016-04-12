all: image

image:
	docker build -t timwolla/csp .

.PHONY: image
