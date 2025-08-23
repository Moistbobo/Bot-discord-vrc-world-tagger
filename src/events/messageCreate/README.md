# Message Create Commands

This directory contains all the commands that can be triggered by messages in Discord channels.

## Available Commands

### `.watch <#channel>`
- **Description**: Start watching a channel for VRChat world links
- **Usage**: `.watch #channel-name`
- **Admin Only**: Yes
- **Example**: `.watch #vrchat-worlds`

### `.unwatch <#channel>`
- **Description**: Stop watching a channel for VRChat world links
- **Usage**: `.unwatch #channel-name`
- **Admin Only**: Yes
- **Example**: `.unwatch #vrchat-worlds`

### `.forwardAndroid <#channel>`
- **Description**: Set a channel to forward Android support messages
- **Usage**: `.forwardAndroid #channel-name`
- **Admin Only**: Yes
- **Example**: `.forwardAndroid #android-support`

### `.forwardMaxSlots <#channel>`
- **Description**: Set a channel to forward player count updates
- **Usage**: `.forwardMaxSlots #channel-name`
- **Admin Only**: Yes
- **Example**: `.forwardMaxSlots #player-counts`

### `.clearForwardingChannels`
- **Description**: Clear all forwarding channel configurations
- **Usage**: `.clearForwardingChannels`
- **Admin Only**: Yes
- **Example**: `.clearForwardingChannels`

### `.remove <#channel>`
- **Description**: Remove a channel from being watched
- **Usage**: `.remove #channel-name`
- **Admin Only**: Yes
- **Example**: `.remove #vrchat-worlds`

### `.die`
- **Description**: Shutdown the bot gracefully
- **Usage**: `.die`
- **Admin Only**: Yes
- **Example**: `.die`

### `.stats`
- **Description**: Display comprehensive bot statistics and activity information
- **Usage**: `.stats`
- **Admin Only**: No (available to all users)
- **Example**: `.stats`
- **Features**:
  - Worlds processed count
  - Channels being watched
  - Forwarding channel configuration
  - Bot uptime and memory usage
  - System information (Node.js version, platform)
  - Last processed world
  - Total activity summary

## Command Protection

Most commands are protected by the `withProtection` wrapper, which restricts access to users whose Discord IDs are listed in the `ADMIN_ID` environment variable.

The `.stats` command is available to all users as it only provides read-only information about bot activity.

## Automatic Processing

When no command is detected, the bot automatically processes the message for VRChat world links using the `watchForVRCWorldLinks` function. 