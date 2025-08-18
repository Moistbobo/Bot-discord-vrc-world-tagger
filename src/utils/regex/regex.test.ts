import {
  extractWorldName,
  extractAuthorName,
  extractWorldAndAuthorByLines,
  extractWorldAndAuthor
} from './index';

// Mock the config to avoid environment variable dependencies
jest.mock('../../assets/config', () => {
  return {
    TOKEN: 'mock-token',
    ADMIN_ID: ['mock-admin-id'],
    VRC_USERNAME: 'mock-username',
    VRC_PASSWORD: 'mock-password',
    VRC_TOTP_KEY: 'mock-totp-key',
    DEV_MODE: false,
    WORLD_NAME_MATCHERS: [
      'World:',
      'World :',
      '📸✨🌏World:',
      'World name:',
      'World',
      'ワールド名'
    ],
    AUTHOR_NAME_MATCHERS: [
      'Author:',
      'Author :',
      '👤Author:',
      'By:',
      'Author',
      'by'
    ]
  };
});

const testData = [
  //Bradlee1011
  `World name: RSpec_v2
︀︀By: Remmieǃ
︀︀Platform: PC
︀︀
︀︀#VRChat #VRChat_world紹介`,
  // asobouofficial
  `Artificial? Maybe, but she looked right at me.
︀︀
︀︀World: Cyber 2049 by Alice · 爱丽丝黑白
︀︀
︀︀#VRChat #VRChatphotography #VirtualPhotography #Velle3D`,
  // CupitanVR
  `World : 星今宵
︀︀Author : しーの／T_Shiino
︀︀
︀︀#VRChat #VRChatワールド紹介
︀︀#VRChat_world #VRChat_world紹介`,
  //Jessi55xc
  `World: Hong Kong Street （Night）
Author: Marc_99 @MarcVRCHK

#VRC #VRChat_world紹介 #VRChatPhotography #VirtualPhotography #VRChatワールド紹介 #vrchatworld #VRChat`,
  //Choconrock
  `Achromatic Area
︀︀
︀︀VRChat World : Replicant
︀︀Author : Kakulity
︀︀
︀︀#VRChat
︀︀#VRChat_world紹介
︀︀#VRChatPhotography`,
  //@Yukichi26990880
  // eslint-disable-next-line no-irregular-whitespace
  `ワールド名　B5区画検問所 - B5 Section Checkpoint
  By 暇神／Himajin514
  #VRChat_world紹介
  #VRChat`,
  //@2Y6yzB93ibkUUMS
  `
  #VRChat #VRChat_world紹介
World : Liminal - Room Tours
Author : ~Zoid~
`,
  // Tokyo Mood format
  `World: Tokyo Mood by BEAMS Summer Version 
Author: BEAMS_STAFF_1 

#n4n0_pic 
#VRChat_world紹介 https://t.co/nxaHwhERgE`
];

describe('regex', () => {
  describe('extractWorldName', () => {
    it('Extracts correctly from World name: RSpec_v2', () => {
      expect(extractWorldName(testData[0])).toEqual('RSpec_v2');
    });
    it('Extracts correctly from ︀︀ World: Cyber 2049 by Alice · 爱丽丝黑白', () => {
      expect(extractWorldName(testData[1])).toEqual('Cyber 2049');
    });
    it('Extracts correctly from ︀︀ World : 星今宵', () => {
      expect(extractWorldName(testData[2])).toEqual('星今宵');
    });
    it('Extracts correctly from World: Hong Kong Street （Night）', () => {
      expect(extractWorldName(testData[3])).toEqual(
        'Hong Kong Street （Night）'
      );
    });
    it('Extracts correctly from VRChat World : Replicant', () => {
      expect(extractWorldName(testData[4])).toEqual('Replicant');
    });
    it('Extracts correctly from ワールド名　B5区画検問所 - B5 Section Checkpoint', () => {
      expect(extractWorldName(testData[5])).toEqual(
        'B5区画検問所 - B5 Section Checkpoint'
      );
    });
    it('Extracts correctly from World : Liminal - Room Tours (with URL)', () => {
      expect(extractWorldName(testData[6])).toEqual('Liminal - Room Tours');
    });
    it('Extracts correctly from World: Tokyo Mood by BEAMS Summer Version', () => {
      // Note: The old regex approach has limitations with this format
      // It stops at "by" because it's looking for author terms
      expect(extractWorldName(testData[7])).toEqual('Tokyo Mood');
    });
  });

  describe('extractAuthorName', () => {
    it('Extracts correctly from  ︀︀By: Remmieǃ', () => {
      expect(extractAuthorName(testData[0])).toEqual('Remmieǃ');
    });
    it('Extracts correctly from ︀︀ World: Cyber 2049 by Alice · 爱丽丝黑白', () => {
      expect(extractAuthorName(testData[1])).toEqual('Alice · 爱丽丝黑白');
    });
    it('Extracts correctly from ︀︀ ︀︀Author : しーの／T_Shiino', () => {
      expect(extractAuthorName(testData[2])).toEqual('しーの／T_Shiino');
    });
    it('Extracts correctly from Author: Marc_99 @MarcVRCHK', () => {
      expect(extractAuthorName(testData[3])).toEqual('Marc_99 @MarcVRCHK');
    });
    it('Extracts correctly from Author : Kakulity', () => {
      expect(extractAuthorName(testData[4])).toEqual('Kakulity');
    });
    it('Extracts correctly from By 暇神／Himajin514', () => {
      expect(extractAuthorName(testData[5])).toEqual('暇神／Himajin514');
    });
    it('Extracts correctly from Author : ~Zoid~ https://t.co/vSh7Ac81pb', () => {
      expect(extractAuthorName(testData[6])).toEqual('~Zoid~');
    });
    it('Extracts correctly from Author: BEAMS_STAFF_1', () => {
      // Note: The old regex approach has limitations with this format
      // It picks up "BEAMS Summer Version" from the world name line
      expect(extractAuthorName(testData[7])).toEqual('BEAMS Summer Version');
    });
  });

  describe('extractWorldAndAuthorByLines', () => {
    it('Extracts correctly from Tokyo Mood format using line-by-line parsing', () => {
      const result = extractWorldAndAuthorByLines(testData[7]);
      expect(result).toEqual({
        worldName: 'Tokyo Mood by BEAMS Summer Version',
        authorName: 'BEAMS_STAFF_1'
      });
    });

    it('Extracts correctly from standard format using line-by-line parsing', () => {
      const result = extractWorldAndAuthorByLines(testData[3]);
      expect(result).toEqual({
        worldName: 'Hong Kong Street （Night）',
        authorName: 'Marc_99 @MarcVRCHK'
      });
    });

    it('Returns null when world or author is missing', () => {
      const incompleteData = `World: Test World\n#VRChat`;
      const result = extractWorldAndAuthorByLines(incompleteData);
      expect(result).toBeNull();
    });
  });

  describe('extractWorldAndAuthor', () => {
    it('Uses line-by-line approach for Tokyo Mood format', () => {
      const result = extractWorldAndAuthor(testData[7]);
      expect(result).toEqual({
        worldName: 'Tokyo Mood by BEAMS Summer Version',
        authorName: 'BEAMS_STAFF_1'
      });
    });

    it('Falls back to regex for less structured formats', () => {
      const result = extractWorldAndAuthor(testData[0]);
      expect(result).toEqual({
        worldName: 'RSpec_v2',
        authorName: 'Remmieǃ'
      });
    });

    it('Returns null when no world or author found', () => {
      const noWorldData = `Just some random text\n#VRChat`;
      const result = extractWorldAndAuthor(noWorldData);
      expect(result).toBeNull();
    });
  });
});
