import React, { Component } from "react";
import { Link } from "react-router-dom";
import classnames from "classnames";
import isEqual from "lodash/isEqual";

import { createUrl, stringifySearchParams } from "../helpers/url";

import withHistoryState from "./withHistoryState";
import WorkingHours from "./WorkingHours";
import ArrowLink from "./ArrowLink";
import MapView from "./MapView";

const { API_ENDPOINT } = window.__CONFIG__;

const DEFAULT_CENTER = { lat: 50.4021368, lng: 30.4525107 };
const DEFAULT_ZOOM = 9;
const MIN_ZOOM = 5;
const DEFAULT_TYPE = "CLINIC";

const DIVISION_TYPES = [
  { name: "CLINIC", title: "Клініки" },
  { name: "AMBULANT_CLINIC", title: "Амбулаторії" },
  { name: "FAP", title: "ФАП" }
  // { name: "DRUGSTORE", title: "Аптеки" },
  // { name: "DRUGSTORE_POINT", title: "Аптечні пункти" }
];

@withHistoryState
export default class DivisionsMap extends Component {
  state = {
    items: [],
    paging: {}
  };

  shouldComponentUpdate(nextProps, nextState) {
    return !isEqual(this.props, nextProps) || !isEqual(this.state, nextState);
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.props.location.search !== prevProps.location.search ||
      !isEqual(this.state.bounds, prevState.bounds)
    ) {
      this.fetchDivisions();
    }
  }

  render() {
    const {
      location: { state: { prevLocation } = {} },
      query: { name, active: activeItemId }
    } = this.props;

    const {
      isLoading,
      items,
      paging: { page_number: currentPage, total_pages: totalPages },
      hoverItemId
    } = this.state;

    return (
      <section className="search">
        <Aside
          prevLocation={prevLocation}
          type={this.type}
          name={name}
          isLoading={isLoading}
          items={items}
          activeItemId={activeItemId}
          currentPage={currentPage}
          totalPages={totalPages}
          onSearchResultClick={this.setActiveItem}
          onNameChange={name => this.props.setQuery({ name })}
          onTypeChange={type => this.props.setQuery({ type })}
          onLoadMore={() => this.fetchDivisions({ page: currentPage + 1 })}
        />
        <MapView
          containerElement={<div className="search__map" />}
          mapElement={<div className="search__map__el" />}
          center={this.center}
          zoom={this.zoom}
          options={{ minZoom: MIN_ZOOM }}
          items={items}
          activeItemId={activeItemId}
          hoverItemId={hoverItemId}
          onMapChange={({ bounds, center, zoom }) => {
            const { lat, lng } = center.toJSON();
            this.setState({ bounds: bounds.toJSON() });
            this.props.setQueryImmediate({ lat, lng, zoom }, "replace");
          }}
          onMarkerClick={this.setActiveItem}
          onMarkerOver={hoverItemId => this.setState({ hoverItemId })}
          onMarkerOut={() => this.setState({ hoverItemId: null })}
        />
      </section>
    );
  }

  get type() {
    return this.props.query.type || DEFAULT_TYPE;
  }

  get center() {
    let { lat, lng } = this.props.query;
    [lat, lng] = [lat, lng].map(n => parseFloat(n, 10));

    return [lat, lng].every(v => !isNaN(v)) ? { lat, lng } : DEFAULT_CENTER;
  }

  get zoom() {
    const { zoom } = this.props.query;
    return parseInt(zoom, 10) || DEFAULT_ZOOM;
  }

  setActiveItem = active => this.props.setQuery({ active });

  async fetchDivisions({ page = 1, page_size = 50 } = {}) {
    const { isLoading, bounds } = this.state;

    if (isLoading || !bounds) return;

    this.setState({ isLoading: true });

    const { name } = this.props.query;
    const { north, east, south, west } = bounds;

    const divisionsResponse = await fetch(
      createUrl(`${API_ENDPOINT}/reports/stats/divisions`, {
        type: this.type,
        name,
        north,
        east,
        south,
        west,
        page,
        page_size
      })
    );

    const { data, paging } = await divisionsResponse.json();

    this.setState(({ items }) => ({
      isLoading: false,
      items: page > 1 ? items.concat(data) : data,
      paging
    }));
  }
}

class Aside extends Component {
  componentWillUpdate() {
    this.searchResultScrolled = null;
  }

  render() {
    const {
      prevLocation,
      type,
      name,
      isLoading,
      items,
      activeItemId,
      currentPage,
      totalPages,
      onSearchResultClick,
      onNameChange,
      onTypeChange,
      onLoadMore
    } = this.props;

    return (
      <aside className="search__aside">
        <div className="search__header">
          {prevLocation && (
            <Link className="search__back" to={prevLocation}>
              <i className="icon icon_name_arrow-left" />
              Повернутися
            </Link>
          )}
          <input
            placeholder="Пошук"
            type="text"
            className="search__input"
            value={name}
            onChange={event => onNameChange(event.target.value)}
          />
          <div className="search__switch">
            <Link
              className="search__switch-link"
              to={{
                pathname: "/",
                search: stringifySearchParams({ name })
              }}
            >
              Відобразити списком
            </Link>
          </div>
          <ul className="search__nav">
            {DIVISION_TYPES.map(({ name, title }) => (
              <li
                key={name}
                className={classnames("search__nav-item", {
                  "search__nav-item_active": name === type
                })}
                onClick={() => onTypeChange(name)}
              >
                {title}
              </li>
            ))}
          </ul>
        </div>
        <div className="search__result">
          {items.length > 0 && (
            <div className="search__result-total">
              Знайдено {items.length} закладів
            </div>
          )}

          {items.length ? (
            <ul className="search__result-list">
              {items.map(
                (
                  {
                    id,
                    name,
                    legal_entity,
                    addresses,
                    contacts,
                    working_hours
                  },
                  index
                ) => {
                  const active = activeItemId === id;
                  const address = addresses.find(
                    ({ type }) => type === "RESIDENCE"
                  );

                  return (
                    <SearchResult
                      key={id}
                      onMount={element =>
                        this.scrollSearchResultIntoView(element, index, active)
                      }
                      active={active}
                      id={id}
                      name={name}
                      legalEntity={legal_entity}
                      address={address}
                      contacts={contacts}
                      workingHours={working_hours}
                      onClick={() => onSearchResultClick(id)}
                    />
                  );
                }
              )}
            </ul>
          ) : (
            isLoading || "Результати відсутні"
          )}

          {isLoading
            ? "Шукаємо записи..."
            : currentPage < totalPages && (
                <a className="search__more" onClick={onLoadMore}>
                  Показати більше
                </a>
              )}
        </div>
      </aside>
    );
  }

  scrollSearchResultIntoView(element, index, active) {
    if (!active && this.searchResultScrolled) return;

    this.searchResultScrolled = true;

    const firstPage = index === 0 || active;

    element.scrollIntoView({
      behavior: firstPage ? "instant" : "smooth",
      block: firstPage ? "center" : "start"
    });
  }
}

class SearchResult extends Component {
  componentDidMount() {
    this.props.onMount(this.element);
  }

  render() {
    const {
      active,
      id,
      name,
      legalEntity,
      address,
      contacts: { phones: [phone] },
      workingHours,
      onClick
    } = this.props;

    return (
      <li
        ref={e => (this.element = e)}
        className={classnames("search__result-item", {
          "search__result-item_active": active
        })}
        onClick={onClick}
      >
        <div className="search__result-item-title">
          {name} ({legalEntity.name})
        </div>
        {active && <div>{address.settlement}</div>}
        <div>
          {address.street}, {address.building}
        </div>
        {active && (
          <div>
            <div>Тел.: {phone.number}</div>
            {workingHours && <WorkingHours workingHours={workingHours} />}
            <ArrowLink to={`/${id}`} title="Детальніше" />
          </div>
        )}
      </li>
    );
  }
}
