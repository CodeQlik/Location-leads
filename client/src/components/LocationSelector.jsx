import React, { useState, useEffect } from "react";

import axios from "axios";
import Select from "react-select";
import { API_BASE } from "../config/api";

export default function LocationSelector({ token, onLocationChange }) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedArea, setSelectedArea] = useState("");

  const [isAddingArea, setIsAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    // Fetch all countries on mount
    axios.get(`${API_BASE}/locations/countries`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setCountries(res.data);
      const india = res.data.find(c => c.isoCode === "IN");
      if (india) setSelectedCountry(india);
    })
    .catch(err => console.error("Error fetching countries:", err));
  }, [token]);



  useEffect(() => {
    if (selectedCountry) {
      axios.get(`${API_BASE}/locations/states`, {
        params: { countryId: selectedCountry._id },
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setStates(res.data))
      .catch(err => console.error("Error fetching states:", err));
      
      setSelectedState(null);
      setSelectedCity(null);
      setSelectedArea("");
    } else {
      setStates([]);
      setSelectedState(null);
      setSelectedCity(null);
      setSelectedArea("");
    }
  }, [selectedCountry, token]);

  useEffect(() => {
    if (selectedState && selectedCountry) {
      axios.get(`${API_BASE}/locations/cities`, {
        params: { countryId: selectedCountry._id, stateId: selectedState._id },
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setCities(res.data))
      .catch(err => console.error("Error fetching cities:", err));
      
      setSelectedCity(null);
      setSelectedArea("");
    } else {
      setCities([]);
      setSelectedCity(null);
      setSelectedArea("");
    }
  }, [selectedState, selectedCountry, token]);

  useEffect(() => {
    if (selectedCity) {
      fetchAreas();
    } else {
      setAreas([]);
      setSelectedArea("");
    }
  }, [selectedCity]);

  useEffect(() => {
    // Notify parent
    const parts = [
      selectedArea,
      selectedCity?.name,
      selectedState?.name,
      selectedCountry?.name
    ].filter(Boolean);
    onLocationChange(parts.join(", "));
  }, [selectedArea, selectedCity, selectedState, selectedCountry, onLocationChange]);

  const fetchAreas = async () => {
    if (!selectedCity || !selectedState || !selectedCountry) return;
    try {
      setFetchError("");
      const res = await axios.get(`${API_BASE}/areas`, {
        params: {
          cityId: selectedCity._id,
          stateId: selectedState._id,
          countryId: selectedCountry._id,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data)) {
        setAreas(res.data);
      } else {
        console.error("API did not return an array:", res.data);
        setFetchError("API did not return an array");
        setAreas([]);
      }
    } catch (err) {
      console.error("Failed to fetch areas", err);
      setFetchError(err.message || "Failed to fetch areas");
      setAreas([]);
    }
  };

  const handleAddArea = async () => {
    if (!newAreaName.trim() || !selectedCity) return;
    try {
      const res = await axios.post(
        `${API_BASE}/areas`,
        {
          name: newAreaName,
          city: selectedCity._id,
          state: selectedState._id,
          country: selectedCountry._id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAreas([...areas, res.data]);
      setSelectedArea(res.data.name);
      setNewAreaName("");
      setIsAddingArea(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add area");
    }
  };

  const customStyles = {
    control: (provided) => ({
      ...provided,
      minHeight: "42px",
      borderRadius: "8px",
      borderColor: "#cbd5e1",
      fontSize: "14px",
      boxShadow: "none",
      "&:hover": { borderColor: "#94a3b8" }
    }),
    container: (provided) => ({
      ...provided,
      flex: 1,
      minWidth: "160px",
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 10
    })
  };

  return (
    <div style={{ display: "flex", gap: "10px", width: "100%", flexWrap: "wrap" }}>
        <Select
          styles={customStyles}
          options={countries.map(c => ({ value: c.isoCode, label: c.name, original: c }))}
          value={selectedCountry ? { value: selectedCountry.isoCode, label: selectedCountry.name } : null}
          onChange={(opt) => setSelectedCountry(opt ? opt.original : null)}
          placeholder="Select Country"
          isClearable
        />

        <Select
          styles={customStyles}
          options={states.map(s => ({ value: s.isoCode, label: s.name, original: s }))}
          value={selectedState ? { value: selectedState.isoCode, label: selectedState.name } : null}
          onChange={(opt) => setSelectedState(opt ? opt.original : null)}
          placeholder="Select State"
          isDisabled={!selectedCountry}
          isClearable
        />

        <Select
          styles={customStyles}
          options={cities.map(c => ({ value: c.name, label: c.name, original: c }))}
          value={selectedCity ? { value: selectedCity.name, label: selectedCity.name } : null}
          onChange={(opt) => setSelectedCity(opt ? opt.original : null)}
          placeholder="Select City"
          isDisabled={!selectedState}
          isClearable
        />

        {isAddingArea ? (
          <>
            <input
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                outline: "none",
                minHeight: "42px",
                boxSizing: "border-box"
              }}
              placeholder="Enter new area (e.g. Malviya Nagar)"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              autoFocus
            />
            <button
              onClick={handleAddArea}
              style={{ padding: "8px 16px", background: "#ff6b35", color: "white", borderRadius: "8px", border: "none", cursor: "pointer" }}
            >
              Save
            </button>
            <button
              onClick={() => setIsAddingArea(false)}
              style={{ padding: "8px 16px", background: "#cbd5e1", color: "#334155", borderRadius: "8px", border: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Select
              styles={customStyles}
              options={areas.map(a => ({ value: a.name, label: a.name }))}
              value={selectedArea ? { value: selectedArea, label: selectedArea } : null}
              onChange={(opt) => setSelectedArea(opt ? opt.value : "")}
              placeholder="Select Area (Optional)"
              isDisabled={!selectedCity}
              isClearable
            />
            <button
              onClick={() => setIsAddingArea(true)}
              disabled={!selectedCity}
              style={{ padding: "8px 12px", background: selectedCity ? "#e2e8f0" : "#f1f5f9", color: "#475569", borderRadius: "8px", border: "1px solid #cbd5e1", cursor: selectedCity ? "pointer" : "not-allowed" }}
              title="Add a custom area to your database"
            >
              + Add Custom Area
            </button>
          </>
        )}
      {fetchError && (
        <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
          Error loading areas: {fetchError}.
        </div>
      )}
    </div>
  );
}
