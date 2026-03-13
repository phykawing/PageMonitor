export type RootStackParamList = {
  Home: undefined;
  AddEditPage: {pageId?: string} | undefined;
  PageDetail: {pageId: string};
  DiffView: {changeRecordId: string};
};
