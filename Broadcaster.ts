import { v4 as uuidv4 } from "uuid";

export type DestroyCallback = () => void;

export interface CustomObserverClass<ConstructorType, TDataType, TObserverProps extends any>
{
	new(callback: (newData: TDataType) => void, input: TObserverProps): ConstructorType;
}

export class BroadcasterObserver<TDataType, TInputType = any>
{
	public readonly callback: (newData: TDataType) => void;
	public readonly params: TInputType;

	constructor(callback: (newData: TDataType) => void, params: TInputType)
	{
		this.callback = callback;
		this.params = params;
	}

	public update(newData: TDataType)
	{
		return new Promise<void>((resolve) => requestAnimationFrame(() =>
		{
			this.callback(newData);
			resolve();
		}));
	}
}

export interface BroadcasterParams<TObserverType, TDataType, TObserverProps>
{
	observerClassConstructor?: CustomObserverClass<TObserverType, TDataType, TObserverProps | undefined> | null;
	propsRequired?: boolean;
}

export class Broadcaster<TDataType, TObserverProps = any, TObserverType extends BroadcasterObserver<TDataType, TObserverProps> = BroadcasterObserver<TDataType>>
{
	protected readonly params: BroadcasterParams<TObserverType, TDataType, TObserverProps>;
	protected readonly observers: { [key: string]: TObserverType } = {};

	protected pendingUpdates: Record<string, Promise<any>> = {};

	/**
	 * Creates a Broadcaster
	 * @param params
	 */
	constructor(
		params?: BroadcasterParams<TObserverType, TDataType, TObserverProps>
	)
	{
		this.params = {
			observerClassConstructor: null,
			propsRequired: false,
			...(params ?? {})
		};
	}

	protected get allObservers(): TObserverType[]
	{
		return Object.values(this.observers);
	}

	public async broadcast(data: TDataType)
	{
		const broadcastTo = this.getObserversToUpdate(data);

		// Assign a guid to this broadcast
		const updateGuid = uuidv4();

		if (broadcastTo.length === 0)
		{
			return Promise.resolve();
		}

		// Store the broadcast in pending updates, and delete it when it's complete
		this.pendingUpdates[updateGuid] = Promise.allSettled(broadcastTo.map(observer => observer.update(data)))
			.then(() => delete this.pendingUpdates[updateGuid]);

		// Return the pending update Promise
		return this.pendingUpdates[updateGuid];
	}

	protected buildObserver(callback: (newData: TDataType) => void, props?: TObserverProps)
	{
		const {
			observerClassConstructor,
			propsRequired
		} = this.params;

		if (propsRequired && props === undefined)
		{
			throw new Error("Props cannot be null, this data store requires props parameters for each observer");
		}

		const observer: TObserverType = observerClassConstructor
			? new observerClassConstructor(callback, props)
			: new BroadcasterObserver(callback, props) as TObserverType;

		return observer;
	}

	protected saveObserver(callback: (newData: TDataType) => void, props?: TObserverProps): { destroy: DestroyCallback; observer: TObserverType }
	{
		const observer = this.buildObserver(callback, props);

		const guid = Broadcaster.guid();

		this.observers[guid] = observer;

		return {
			destroy: () => delete this.observers[guid],
			observer: observer
		};
	}

	/**
	 * Observe this broadcaster. Call the returned callback to destroy.
	 * @param props The further input about the observer, if any
	 * @param callback
	 */
	public observe(callback: (newData: TDataType) => void, props?: TObserverProps): DestroyCallback
	{
		const {destroy} = this.saveObserver(callback, props);

		return destroy;
	}

	protected static guid()
	{
		return (new Date().getTime() * Math.random()).toString(36);
	}

	/**
	 * Returns a list of observers, optional update parameter can be use to filter the observer list
	 * @param data
	 * @protected
	 */
	protected getObserversToUpdate(data: TDataType)
	{
		return this.allObservers;
	}

	public static destroyAll(...destroyCallbacks: DestroyCallback[])
	{
		destroyCallbacks.forEach(u => u());
	}
}
