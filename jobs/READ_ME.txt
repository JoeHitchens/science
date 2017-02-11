
=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
Fishy Science Job Daemon Version 1
=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

There are 5 folders here - prep, start, working, finished, and fail

Prepare your job by making a folder in "prep" and getting everything copied in and set up.
The folder that you create is your "job".

When you're ready to start the job, drag it into the "start" folder.  
It should disappear within a few seconds and reappear in the "working" folder.

As long as your job is in the working folder, it's being processed.

If the job finishes normally, it will be moved to the "finished" folder.
It should contain a "data_out" folder with your output files.

If something goes wrong, your job folder will be moved to the "failed" folder.
There should be a file called "errors.txt" which you can open and read to find out
what went wrong.
You can move the job back to "prep" and work on correcting any issues there, then
drag it back into the "start" folder to try running it again.



Preparing a job
-----------------

Create your job folder and call it whatever you want.
Create a subfolder called "data_in" and put all your .fastq.gz files in there.

In addition to the "data_in" folder there should be these files:

   - locus_info.csv
   - assay_info.csv
   - sex_info.csv



