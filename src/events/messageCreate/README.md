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

### `.export`
- **Description**: Export a simple list of all processed world IDs in CSV format
- **Usage**: `.export`
- **Admin Only**: No (available to all users)
- **Example**: `.export`
- **Features**:
  - Fast execution (no API calls required)
  - Simple CSV with Index and World ID columns
  - Instant results for quick access to world IDs
  - Useful for bulk operations or quick reference

### `.exportFull`
- **Description**: Export comprehensive world information with detailed data from VRChat API
- **Usage**: `.exportFull`
- **Admin Only**: No (available to all users)
- **Example**: `.exportFull`
- **Features**:
  - Detailed CSV with world names, authors, capacity, platforms, and status
  - Fetches live data from VRChat API for each world
  - Rate-limited to respect VRChat API limits
  - Progress updates during export process
  - Cancellable with reaction (❌)
  - Error collection and reporting
  - Separate error text file when API errors occur
  - **Note**: Only one full export can run at a time to prevent API overload

### `.stats`
- **Description**: Display comprehensive bot statistics and activity information
- **Usage**: `.stats`
- **Admin Only**: No (available to all users)
- **Channel Restriction**: Only works in channels being watched with `.watch`
- **Example**: `.stats`
- **Features**:
  - Worlds processed count
  - Channels being watched
  - Forwarding channel configuration
  - Bot uptime and memory usage
  - System information (Node.js version, platform)
  - Last processed world
  - Total activity summary

### `.export`
- **Description**: Export all processed worlds to a CSV file
- **Usage**: `.export`
- **Admin Only**: Yes
- **Example**: `.export`
- **Features**:
  - Generates CSV file with all processed world IDs
  - Includes export date, total count, and timestamp
  - CSV columns: World ID, Export Date, Total Worlds, Export Timestamp
  - File named with current date and time (e.g., `vrchat_worlds_export_2024-01-15T12-30-45-123Z.csv`)
  - Useful for data analysis, backup, and tracking purposes

## Command Protection

Most commands are protected by the `withProtection` wrapper, which restricts access to users whose Discord IDs are listed in the `ADMIN_ID` environment variable.

The following commands are available to all users as they only provide read-only information or export functionality:
- `.stats` - Bot statistics and activity information
- `.export` - Simple world ID export
- `.exportFull` - Detailed world information export

## Automatic Processing

When no command is detected, the bot automatically processes the message for VRChat world links using the `watchForVRCWorldLinks` function.
