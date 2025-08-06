# Message Create Commands

This file documents all the commands available in the messageCreate event handler.

## Commands

### `.watch`
Add a channel to the watch list for tagging.

### `.unwatch`
Remove a channel from the watch list.

### `.forwardAndroid`
Set a channel as forward target for android compatible worlds. Subsequent calls will overwrite the last.

### `.forwardMaxSlots`
Set a channel as forward target for worlds with >=60 people. Subsequent calls will overwrite the last.

### `.clearForwardingChannels`
Clear the forwarding targets (done like this because I am lazy)

### `.die`
Kills the bot before it kills us

## Default Behavior
If no command is recognized, the message is passed to `watchForVRCWorldLinks` for VRC world link processing. 