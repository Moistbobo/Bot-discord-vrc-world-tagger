export const extractWorldLink = (message: string) => {
  const regex = /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}/;
  const match = message.match(regex);
  return match ? match[0] : null;
};

export const extractWorldId = (message: string) => {
  const regex = /wrld_[a-f0-9-]{36}/;
  const match = message.match(regex);
  return match ? match[0] : null;
};

export const removeVRChatLink = (message: string) => {
  const regex =
    /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}(\/\S*)?/;
  return `${message.replace(regex, '').trim()} `;
};
