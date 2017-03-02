
Fishy Science Version 4
========================

Created by Joe Hitchens, Sleepless Software, Inc. (2017)


Open the cmd window (go to the Windows Start menu, and type "cmd" in the "Search programs and files" bar at the bottom.  Double-click
the "cmd" program it finds.  At the prompt, navigate to C:\Users\Ewann.Berntson\science.  Type "node jobd.js" then hit Enter.  This 
will start the process.  This window must remain open while you are analyzing data. 

If your job is not processing once you copy your job folder to the "start" folder (see README file in "jobs") check the cmd window and 
make sure the jobd.js is still running.  If you find an error message and the prompt is at "Science," simply re-type "node jobd.js" 
and hit Enter, and your job should then process.

Joe says:

	The jobd.js (job daemon) was written to be running all the time, so there's no technical reason
	why it has to ever be stopped.  If it crashes, you'll have to restart it of course.
	The idea was that the daemon is always just sitting there waiting for people to give it a job to do.

	Also, it should be possible to just double-click on the jobd.bat file to open a cmd window and start the daemon.


