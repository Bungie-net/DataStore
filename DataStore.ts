import deepEqual from "deep-equal";
import allSettled from "promise.allsettled";
import { Broadcaster, BroadcasterObserver, BroadcasterParams, CustomObserverClass, DestroyCallback } from "./Broadcaster";
import type { AsyncDataStoreActions, AsyncReturn, DataStoreActions, IDataStore } from "./types";

// Bug 1031244 // Add shim for Promise.allSettled for browsers that lack support
allSettled.shim();

export abstract class DataStore<TDataType extends Record<string, any>,
	TObserverProps = any,
	TObserverType extends BroadcasterObserver<TDataType, TObserverProps> = BroadcasterObserver<TDataType, TObserverProps>>
	extends Broadcaster<TDataType, TObserverProps, TObserverType> implements IDataStore<TDataType, TObserverProps, any>
{
	private _internalState: TDataType;

	public get state()
	{
		return this._internalState;
	}

	/**
	 * Creates a DataStore
	 * @param initialData The starting data (can be null)
	 * @param params
	 */
	constructor(
		initialData: TDataType,
		params?: BroadcasterParams<TObserverType, TDataType, TObserverProps>)
	{
		super(params);

		this._internalState = initialData;
	}
	actions: AsyncDataStoreActions<TDataType, any>;

	/**
	 * Creates a helper function for actions which updates the data store when the action returns
	 * @param actions An object of functions which return data that updates the store
	 */
	protected readonly createActions = <T extends DataStoreActions<TDataType>>(actions: T) =>
	{
		return Object.keys(actions).reduce((acc, item: keyof T) =>
		{
			const action = actions[item];

			const func = (...args: any[]) =>
			{
				// Call it, with the given arguments
				const result = action.apply(this, [this.state, ...args]);

				if (!result || typeof result !== "object")
				{
					throw new Error("Actions must output data that is compatible with the DataStore's state. Received null, undefined, or a non-object result.");
				}

				// Determine whether the result is a promise
				const isAsync = result[Symbol.toStringTag] === "AsyncFunction" || result[Symbol.toStringTag] === "Promise";

				const promisified: Promise<any> = isAsync
					? result
					: Promise.resolve(result);

				const promise = promisified.then(outputData =>
				{
					return this.update(outputData)
				});

				return {
					/**
					 * This promise will be resolved once the broadcast for this action call has completed
					 */
					async: promise
				} as AsyncReturn;
			};

			acc[item] = func as any;

			return acc;

		}, {} as AsyncDataStoreActions<TDataType, T>);
	}

	/**
	 * Update the store with new data, and update subscribers.
	 * @param data
	 */
	private async update(data: Partial<TDataType>)
	{
		const newState = {...this._internalState, ...data};
		const equal = deepEqual(newState, this._internalState);

		if (equal)
		{
			return false;
		}

		this._internalState = {...this._internalState, ...data} as TDataType;

		await this.broadcast(this._internalState);

		return true;
	}


	/**
	 * Run a callback after all pending updates have completed
	 * @param {() => void} callback
	 * @private
	 */
	private nextTick(callback: () => void)
	{
		const pendingUpdatePromises = Object.values(this.pendingUpdates);

		Promise.allSettled(pendingUpdatePromises)
			.finally(callback);
	}

	/**
	 * Observe this data store. Call the returned callback to destroy.
	 * @param updateImmediately (default = true) If true, the callback will be called immediately on creation, with current data.
	 * @param props The further input about the observer, if any
	 * @param callback
	 */
	public observe(
		callback: (newData: TDataType) => void,
		props?: TObserverProps,
		updateImmediately = true): DestroyCallback
	{
		const {destroy, observer} = this.saveObserver(callback, props);

		if (updateImmediately)
		{
			// Update the callback once any pending updates are completed
			this.nextTick(() =>
			{
				observer.callback(this._internalState);
			});
		}

		return destroy;
	}
}

/**
 * Returns the `build()` method that will create a new DataStore
 * @returns {{build: <T extends DataStoreActions<TDataType>>(params: {actions: T, initialState: TDataType, subscriptionConstructor?: CustomObserverClass<TObserverType, TDataType, TObserverProps> | undefined, propsRequired?: boolean}) => IDataStore<TDataType, TObserverProps>}}
 */
export function getDataStoreBuilder<TDataType extends Record<string, any>,
	TObserverProps = any,
	TObserverType extends BroadcasterObserver<TDataType, TObserverProps> = BroadcasterObserver<TDataType, TObserverProps>>()
{
	/**
	 * Creates a new DataStore instance
	 * @param {{actions: T, initialState: TDataType, subscriptionConstructor?: CustomObserverClass<TObserverType, TDataType, TObserverProps> | undefined, propsRequired?: boolean}} buildParams
	 * @returns {IDataStore<TDataType, TObserverProps>}
	 */
	const build = <T extends DataStoreActions<TDataType>>(buildParams: {
		actions: T;
		initialState: TDataType;
		dataStoreParams?: BroadcasterParams<TObserverType, TDataType, TObserverProps>
	}): IDataStore<TDataType, TObserverProps, T> =>
	{
		return new class extends DataStore<TDataType, TObserverProps, TObserverType>
		{
			public actions = this.createActions(buildParams.actions);
		}(buildParams.initialState, buildParams.dataStoreParams) as IDataStore<TDataType, TObserverProps, T>;
	};

	return {
		build
	};
}
