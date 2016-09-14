
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <utime.h>
#include <sys/stat.h>


const char *read_file(const char *path) {
	struct stat buf;
	int r = lstat(path, &buf);
	if(r != 0) {
		throw "can't stat";
	}
	unsigned int size = buf.st_size;
	char *bytes = (char *)malloc(size + 1);
	if(!bytes) {
		throw "can't allocate";
	}
	FILE *fp = fopen(path, "rb");
	if(!fp) {
		throw "can't open";
	}
	if(fread(bytes, 1, size, fp) != size) {
		throw "can't read";
	}
	fclose(fp);
	bytes[size] = 0;
	return bytes;
}


int main(int argc, char **argv) {
	int rc = 0;
	try {

		const char *s = read_file(argv[1]);

	}
	catch(const char *err) {
		printf("ERROR: %s\n", err);
		rc = 1;
	}
	return rc;
}




