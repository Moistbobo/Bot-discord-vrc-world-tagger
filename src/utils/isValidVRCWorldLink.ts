export const isValidVRCWorldLink = (url: string) => {
  const regex = /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}/;
  return regex.test(url);
};
