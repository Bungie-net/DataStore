import { useEffect, useState } from "react";
import { DataStoreActions, IDataStore } from "./types";

/**
 * Subscribe to a data store such that the data is always up-to-date.
 * @param ds
 * @param props
 * @param updateImmediately
 */
export const useDataStore = <TDataType extends Record<string, any>, TObserverProps extends any, TActions extends DataStoreActions<TDataType>>(
	ds: IDataStore<TDataType, TObserverProps, TActions>,
	props?: TObserverProps,
	updateImmediately?: boolean
): TDataType =>
{
	const [current, setCurrent] = useState(ds.state);

	useEffect(() =>
	{
		const destroy = ds.observe(setCurrent, props, updateImmediately);

		return () => destroy();
	}, [props]);

	return current;
};
