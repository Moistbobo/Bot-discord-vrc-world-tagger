export const extractWorldLink = (message: string) => {
  if (!message) return null;
  const regex = /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}/;
  const match = message.match(regex);
  return match ? match[0] : null;
};

export const extractWorldId = (message: string) => {
  if (!message) return null;
  const regex = /wrld_[a-f0-9-]{36}/;
  const match = message.match(regex);
  return match ? match[0] : null;
};

export const removeVRChatLink = (message: string) => {
  if (!message) return null;
  const regex =
    /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}(\/\S*)?/;
  return `${message.replace(regex, '').trim()} `;
};

export const getLinkFromMessage = (message: string) => {
  if (!message) return null;
  const match = message.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
};

export const removeTwitterLink = (link: string) => {
  if (!link) return null;
  const match = link.match(
    /(?:https?:\/\/)?(?:x\.com|fixupx\.com|vxtwitter\.com)\/([^?\s]+)/
  );

  return match ? match[1] : null;
};
