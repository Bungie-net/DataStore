import { DestroyCallback } from "./Broadcaster";

export type DataStoreActionReturn<TDataType> = Partial<TDataType> | Promise<Partial<TDataType>>;

export type DataStoreActions<TDataType> = Record<any, (state: TDataType, ...args: any[]) => DataStoreActionReturn<TDataType>>;

// Ditch the first parameter argument of a function
export type OmitFirstArg<F extends (state: any, ...args: any[]) => any> =
	F extends (state: any, ...args: infer P) => ReturnType<F>
		? (...args: P) => ReturnType<F>
		: F;

export type AsyncReturn = { async: Promise<boolean> };

export type AsyncDataStoreActions<TDataType, TActions extends DataStoreActions<TDataType>> = {
	[K in keyof TActions]: OmitFirstArg<(...args: Parameters<TActions[K]>) => AsyncReturn>
};


export interface IDataStore<TDataType, TObserverProps, T extends DataStoreActions<TDataType>>
{
	state: TDataType
	
	actions: AsyncDataStoreActions<TDataType, T>;

	observe(
		callback: (newData: TDataType) => void,
		props?: TObserverProps,
		updateImmediately?: boolean): DestroyCallback
}
