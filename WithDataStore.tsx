import {DataStore} from "./DataStore";
import React from "react";
import {useDataStore} from "./DataStoreHooks";

/**
 * Allows you to wrap a component in a DataStore subscriber, such that the components props always contain an updated version of its state..
 * @param givenDataStore
 * @param BoundComponent The component to provide with global state.
 * @param dataStoreProps
 * @param updateImmediately
 */
export const withDataStore = <TDataType extends Record<string, any>,
	TObserverProps extends any,
	TDataStore extends DataStore<TDataType, TObserverProps>,
	P extends TDataType>
(
	givenDataStore: TDataStore,
	// The Props type here removes the non-datastore props from the required props when rendering the resulting component
	BoundComponent: React.ComponentType<Omit<P, keyof TDataType>>,
	dataStoreProps?: TObserverProps,
	updateImmediately?: boolean
): React.FC<P> => (props) =>
{
	const {...state} = useDataStore(givenDataStore, dataStoreProps, updateImmediately);

	return (
		<BoundComponent {...props} {...state}/>
	);
}
