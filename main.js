document.addEventListener("DOMContentLoaded", function () {
  // Initialize Scrollama
  const scroller = scrollama();
  let chart; // Will hold our chart instance
  let lastStepIndex = -1; // Track the last active step

  // Set up Scrollama steps
  scroller
    .setup({
      step: ".step", // Elements that trigger visualization updates
      offset: 0.5, // Trigger when step is 50% in view
      debug: false, // Set to true for debugging
    })
    .onStepEnter((response) => {
      // Update active step
      document.querySelectorAll(".step").forEach((el) => {
        el.classList.remove("is-active");
      });
      response.element.classList.add("is-active");

      // Update visualization based on current step and direction
      if (chart) {
        const isScrollingDown = response.direction === "down";
        const isScrollingUp = response.direction === "up";

        // Store the current step index for reference
        const currentIndex = response.index;

        updateVisualization(
          currentIndex,
          isScrollingDown,
          isScrollingUp,
          lastStepIndex
        );
        lastStepIndex = currentIndex;
      }
    });

  // Handle window resize
  window.addEventListener("resize", scroller.resize);

  // Chart initialization and update functions
  function initializeChart() {
    // Load data
    d3.csv("CGMacros_merge.csv").then(function (data) {
      // Convert data types
      data.forEach((d) => {
        d.Timestamp = new Date(d.Timestamp);
        d["Libre GL"] = +d["Libre GL"];
        d["Dexcom GL"] = +d["Dexcom GL"];
        d["Meal Type"] = d["Meal Type"];
        d["Calories"] = +d["Calories"];
        d["Carbs"] = +d["Carbs"];
        d["Protein"] = +d["Protein"];
        d["Fat"] = +d["Fat"];
        d["Fiber"] = +d["Fiber"];
        d["Amount Consumed"] = +d["Amount Consumed"];
      });

      // Get unique participants for dropdown
      let participants = [...new Set(data.map((d) => d.Participant_ID))];

      // Populate dropdown
      let dropdown = d3.select("#participantDropdown");
      dropdown
        .selectAll("option")
        .data(participants)
        .enter()
        .append("option")
        .text((d) => d);

      // Set up chart dimensions
      const svg = d3.select("#glucoseChart"),
        width = +svg.attr("width"),
        height = +svg.attr("height"),
        margin = { top: 20, right: 50, bottom: 50, left: 70 };

      // Clear existing SVG content
      svg.selectAll("*").remove();

      // Set up scales
      const xScale = d3.scaleTime().range([margin.left, width - margin.right]);
      const yScale = d3
        .scaleLinear()
        .range([height - margin.bottom, margin.top]);

      // Add axes groups with initial opacity 0
      const xAxis = svg
        .append("g")
        .attr("class", "x-axis")
        .style("opacity", 0)
        .attr("transform", `translate(0,${height - margin.bottom})`);

      const yAxis = svg
        .append("g")
        .attr("class", "y-axis")
        .style("opacity", 0)
        .attr("transform", `translate(${margin.left},0)`);

      // Add axis labels with initial opacity 0
      const xLabel = svg
        .append("text")
        .attr("class", "x-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height - 10)
        .style("opacity", 0)
        .text("Date");

      const yLabel = svg
        .append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .style("opacity", 0)
        .text("Glucose Level (mg/dL)");

      // Set up line generator
      const line = d3
        .line()
        .x((d) => xScale(d.Timestamp))
        .y((d) => yScale(d["Libre GL"]));

      // Create clipping path
      svg
        .append("defs")
        .append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom);

      // Create a group for chart content
      const chartContent = svg
        .append("g")
        .attr("clip-path", "url(#chart-clip)");

      // Create a specific group for lines (below points)
      const lineGroup = chartContent.append("g").attr("class", "line-group");

      // Create a specific group for points (above lines)
      const pointGroup = chartContent.append("g").attr("class", "point-group");

      // Create tooltip
      const tooltip = d3.select(".tooltip");

      // Initialize participant and data variables
      let currentParticipant = participants[0];
      let filteredData = [];
      let originalData = [];
      let mealIndices = [];
      let mealData = [];
      let isZoomed = false;
      let lineSegments = []; // Store line segments data for zooming
      let linesCreated = false; // Track if lines have been created

      // Store chart components for updates
      chart = {
        svg,
        xScale,
        yScale,
        xAxis,
        yAxis,
        xLabel,
        yLabel,
        line,
        chartContent,
        lineGroup,
        pointGroup,
        tooltip,
        data,
        participants,
        currentParticipant,
        filteredData,
        originalData,
        mealIndices,
        mealData,
        isZoomed,
        lineSegments,
        updateData,
        margin,
        width,
        height,
        linesCreated,
      };

      const tableGroup = chart.svg
        .append("g")
        .attr("class", "table-group")
        .style("opacity", 0)
        .style("pointer-events", "none");
      const sampleData = chart.data.slice(220, 240);
      const headers = [
        "Libre GL",
        "Meal Type",
        "Calories",
        "Carbs",
        "Protein",
        "Fat",
        "Fiber",
      ];
      const startX = chart.width / 4 - 150;
      const startY = chart.height / 4 - 50;
      const rowHeight = 20;

      tableGroup
        .append("text")
        .attr("x", startX)
        .attr("y", startY - 30)
        .attr("font-weight", "bold")
        .text("Sample Data");

      headers.forEach((header, i) => {
        tableGroup
          .append("text")
          .attr("x", startX + i * 100)
          .attr("y", startY)
          .attr("font-weight", "bold")
          .text(header);
      });

      sampleData.forEach((row, rIdx) => {
        headers.forEach((header, cIdx) => {
          tableGroup
            .append("text")
            .attr("x", startX + cIdx * 100)
            .attr("y", startY + (rIdx + 1) * rowHeight)
            .text(
              row[header] !== ""
                ? typeof row[header] !== "number"
                  ? row[header]
                  : row[header].toFixed(2)
                : "NaN"
            );
        });
      });

      // Initial data update
      updateData(currentParticipant, false); // No animation for initial load

      // Set up dropdown event listener
      dropdown.on("change", function () {
        chart.currentParticipant = this.value;
        updateData(chart.currentParticipant, true); // Add animation when changing participants

        // Re-apply current visualization state
        const activeStepIndex = Array.from(
          document.querySelectorAll(".step")
        ).findIndex((step) => step.classList.contains("is-active"));

        const stepIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
        updateVisualization(stepIndex, true, false, stepIndex - 1);
      });

      // Add click listener to reset zoom
      svg.on("dblclick", (event) => {
        if (chart.isZoomed) {
          resetZoom();
          // Re-apply current visualization state
          const activeStepIndex = Array.from(
            document.querySelectorAll(".step")
          ).findIndex((step) => step.classList.contains("is-active"));
          updateVisualization(
            activeStepIndex >= 0 ? activeStepIndex : 0,
            false,
            false,
            activeStepIndex
          );
        }
      });
    });
  }

  function createDiabetesVisualization() {
    const peopleGroup = chart.svg.append("g").attr("class", "people-group");
    const columns = 5,
      rows = 2,
      personSize = 125,
      rowSpacing = 200;
    const offsetX = chart.width / 2 - (columns * personSize) / 2;
    const offsetY = chart.height / 2 - (rows * personSize) / 2;

    for (let i = 0; i < 10; i++) {
      peopleGroup
        .append("image")
        .attr("x", offsetX + (i % columns) * personSize)
        .attr(
          "y",
          offsetY + Math.floor(i / columns) * personSize + (i < 5 ? -10 : 10)
        )
        .attr("width", personSize)
        .attr("height", personSize)
        .attr("href", "person.svg")
        .style("opacity", 0)
        .transition()
        .duration(500)
        .delay(i * 100)
        .style("opacity", i === 0 ? 1 : 0.35);
    }
  }

  // Function to update data for a specific participant
  function updateData(participant, animate = false) {
    // Clear all existing elements first
    chart.pointGroup.selectAll(".dot").remove();
    chart.lineGroup.selectAll(".line-segment").remove();

    chart.filteredData = chart.data.filter(
      (d) => d.Participant_ID === participant
    );
    chart.originalData = [...chart.filteredData]; // Store a copy of the original data

    // Get meal indices
    chart.mealIndices = chart.filteredData
      .map((d, i) =>
        d["Meal Type"] && d["Meal Type"].trim() !== "" ? i : null
      )
      .filter((i) => i !== null);

    // Get meal data points
    chart.mealData = chart.filteredData.filter(
      (d) => d["Meal Type"] && d["Meal Type"].trim() !== ""
    );

    // Update scales
    chart.xScale.domain(d3.extent(chart.filteredData, (d) => d.Timestamp));
    chart.yScale.domain([
      d3.min(chart.filteredData, (d) => d["Libre GL"]) - 10,
      d3.max(chart.filteredData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes (but don't show them yet)
    chart.xAxis
      .transition()
      .duration(750)
      .call(d3.axisBottom(chart.xScale).ticks(5));
    chart.yAxis.transition().duration(750).call(d3.axisLeft(chart.yScale));

    // Reset zoom state when changing participants
    chart.isZoomed = false;
    chart.lineSegments = [];
    chart.linesCreated = false; // Reset lines created flag

    // Get current step to determine if we need to recreate elements
    const activeStepIndex = Array.from(
      document.querySelectorAll(".step")
    ).findIndex((step) => step.classList.contains("is-active"));

    // If we're on step 1 or beyond, recreate the points and show axes
    if (activeStepIndex >= 1) {
      // Show axes and labels
      fadeInAxesAndLabels();
      createPoints(animate);
    } else {
      // Hide axes and labels
      fadeOutAxesAndLabels();
    }

    // If we're on step 2 or beyond, recreate the lines
    if (activeStepIndex >= 2) {
      // We'll recreate lines in updateVisualization
      // Just marking that we need to recreate them
      chart.linesCreated = false;
    }
  }

  // Function to fade in axes and labels
  function fadeInAxesAndLabels() {
    chart.xAxis.transition().duration(500).style("opacity", 1);
    chart.yAxis.transition().duration(500).style("opacity", 1);
    chart.xLabel.transition().duration(500).style("opacity", 1);
    chart.yLabel.transition().duration(500).style("opacity", 1);
  }

  // Function to fade out axes and labels
  function fadeOutAxesAndLabels() {
    chart.xAxis.transition().duration(500).style("opacity", 0);
    chart.yAxis.transition().duration(500).style("opacity", 0);
    chart.xLabel.transition().duration(500).style("opacity", 0);
    chart.yLabel.transition().duration(500).style("opacity", 0);
  }

  // Function to update visualization based on scroll step and direction
  function updateVisualization(
    stepIndex,
    isScrollingDown,
    isScrollingUp,
    lastStepIndex
  ) {
    if (!chart) return;

    // Blank chart
    if (stepIndex === 0) {
      // If scrolling up from step 1+, remove points/lines and hide axes
      if (isScrollingUp && lastStepIndex > 0) {
        chart.pointGroup
          .selectAll(".dot")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.lineGroup
          .selectAll(".line-segment")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.linesCreated = false;

        // Fade out axes and labels when scrolling back to step 0
        fadeOutAxesAndLabels();
        chart.svg
          .selectAll(".people-group")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();
      }
    }

    if (stepIndex === 1) {
      // Create 10-person visualization when entering "Why Should You Care?"
      if (isScrollingDown) {
        createDiabetesVisualization();
      }
      // Remove when scrolling away
      else if (isScrollingUp) {
        fadeOutAxesAndLabels();
        createDiabetesVisualization();
        chart.pointGroup
          .selectAll(".dot")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.svg
          .select(".table-group")
          .transition()
          .duration(500)
          .style("opacity", 0);
      }
    }

    // Creates temporary table of data
    else if (stepIndex === 2) {
      if (isScrollingDown) {
        // Fade out people
        chart.svg
          .selectAll(".people-group")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.svg
          .select(".table-group")
          .transition()
          .duration(500)
          .style("opacity", 1);
        chart.xAxis.transition().duration(500).style("opacity", 0);
        chart.yAxis.transition().duration(500).style("opacity", 0);
      } else if (isScrollingUp) {
        chart.pointGroup
          .selectAll(".dot")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        // Fade axes and labels out
        fadeOutAxesAndLabels();

        // Add table back
        chart.svg
          .select(".table-group")
          .transition()
          .duration(500)
          .style("opacity", 1);
        chart.xAxis.transition().duration(500).style("opacity", 0);
        chart.yAxis.transition().duration(500).style("opacity", 0);
      }
    }

    // Show meal points and fade in axes/labels
    else if (stepIndex === 3) {
      if (isScrollingDown) {
        // Remove table
        chart.svg
          .select(".table-group")
          .transition()
          .duration(500)
          .style("opacity", 0);

        // Add axes and labels
        fadeInAxesAndLabels();

        // Remove existing line segments when scrolling down to step 1
        chart.lineGroup
          .selectAll(".line-segment")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.linesCreated = false;

        // Create dots with fade-in
        createPoints(true);
      } else if (isScrollingUp && lastStepIndex > 2) {
        // If scrolling up from step 2, just remove line segments
        chart.lineGroup
          .selectAll(".line-segment")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.linesCreated = false;

        // Make sure points are visible
        if (!chart.pointGroup.selectAll(".dot").size()) {
          createPoints(true);
        }
      }
    }

    // Show line segments connecting meal points
    else if (stepIndex >= 2) {
      // First ensure all points are visible
      if (!chart.pointGroup.selectAll(".dot").size()) {
        createPoints(false);
      }

      // Ensure axes and labels are visible
      fadeInAxesAndLabels();

      // Handle line segments based on direction
      if (!chart.linesCreated) {
        // Sort meal indices chronologically
        const sortedMealIndices = [...chart.mealIndices].sort((a, b) => a - b);
        chart.lineSegments = []; // Reset the line segments data

        // Draw line segments between meal points in sequence
        for (let i = 0; i < sortedMealIndices.length - 1; i++) {
          const startIndex = sortedMealIndices[i];
          const endIndex = sortedMealIndices[i + 1];
          const segmentData = chart.filteredData.slice(
            startIndex,
            endIndex + 1
          );

          // Store segment data for zooming
          chart.lineSegments.push(segmentData);

          // Create a path generator for animation
          const pathGenerator = d3
            .line()
            .x((d) => chart.xScale(d.Timestamp))
            .y((d) => chart.yScale(d["Libre GL"]));

          // Create line segment with starting position at the top
          const initialPathData = segmentData.map((d) => {
            return {
              Timestamp: d.Timestamp,
              "Libre GL": chart.yScale.domain()[0] - 20, // Start above the chart
            };
          });

          const path = chart.lineGroup
            .append("path")
            .datum(segmentData)
            .attr("class", "line-segment")
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 2)
            .attr("d", pathGenerator(initialPathData))
            .style("opacity", 0);

          // Animate the path dropping in - SLOWER ANIMATION
          path
            .transition()
            .delay(i * 50) // Staggered delay
            .duration(1000) // 1 second duration
            .attr("d", pathGenerator)
            .style("opacity", 1);

          // Add interaction after animation
          path
            .on("mouseover", function () {
              d3.select(this).attr("stroke-width", 4);
            })
            .on("mouseout", function () {
              d3.select(this).attr("stroke-width", 2);
            })
            .on("click", function (event, d) {
              event.stopPropagation();
              if (!chart.isZoomed) {
                zoomToSegment(d);
              }
            });
        }

        chart.linesCreated = true; // Mark lines as created
      }
    }
  }

  // Helper function to create points
  function createPoints(animate) {
    const sortedMealData = [...chart.mealData].sort(
      (a, b) => a.Timestamp - b.Timestamp
    );

    // Create dots
    const dots = chart.pointGroup
      .selectAll(".dot")
      .data(sortedMealData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => chart.xScale(d.Timestamp))
      .attr("r", 5)
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);

    if (animate) {
      dots
        .attr("cy", -10) // Start from top
        .style("opacity", 0)
        .transition()
        .duration(500)
        .delay((d, i) => i * 20)
        .attr("cy", (d) => chart.yScale(d["Libre GL"]))
        .style("opacity", 1);
    } else {
      dots.attr("cy", (d) => chart.yScale(d["Libre GL"])).style("opacity", 1);
    }
  }

  // Tooltip functions
  function showTooltip(event, d) {
    // Get the browser's viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate position based on where the point is on the x-axis
    // Get the chart's width and calculate the halfway point
    const chartWidth = chart.width;
    const halfwayPoint =
      chart.xScale(chart.xScale.domain()[0]) +
      (chartWidth - chart.margin.left - chart.margin.right) / 2;

    // Check if the point is past the halfway point
    const isPastHalfway = chart.xScale(d.Timestamp) > halfwayPoint;

    // Position the tooltip to the left or right based on the point's position
    let xPos;
    if (isPastHalfway) {
      // If past halfway, position tooltip to the left of the point
      xPos = event.clientX - 190; // Adjust this value based on tooltip width
    } else {
      // If before halfway, position tooltip to the right of the point
      xPos = event.clientX + 20;
    }

    let yPos = event.clientY - 10;

    // Create the tooltip content
    const amountConsumed = Math.min(+d["Amount Consumed"] || 0, 100) / 100;
    const adjustedCalories = ((+d.Calories || 0) * amountConsumed).toFixed(2);
    const adjustedCarbs = ((+d.Carbs || 0) * amountConsumed).toFixed(2);
    const adjustedProtein = ((+d.Protein || 0) * amountConsumed).toFixed(2);
    const adjustedFat = ((+d.Fat || 0) * amountConsumed).toFixed(2);
    const adjustedFiber = ((+d.Fiber || 0) * amountConsumed).toFixed(2);

    const content = `
                <strong>${d["Meal Type"] || "Unknown Meal"}</strong><br>
                Calories: ${adjustedCalories}<br>
                Carbs: ${adjustedCarbs}g<br>
                Protein: ${adjustedProtein}g<br>
                Fat: ${adjustedFat}g<br>
                Fiber: ${adjustedFiber}g<br>
                Glucose: ${d["Libre GL"].toFixed(1)} mg/dL
              `;

    // First set content and make visible but off-screen for measurement
    chart.tooltip
      .html(content)
      .style("display", "block")
      .style("left", `${xPos}px`)
      .style("top", `${yPos}px`);

    // Get element dimensions after content is set
    const tooltipElement = chart.tooltip.node();
    const tooltipWidth = tooltipElement.offsetWidth;
    const tooltipHeight = tooltipElement.offsetHeight;

    // Ensure tooltip doesn't go outside viewport
    if (xPos + tooltipWidth > viewportWidth) {
      xPos = viewportWidth - tooltipWidth - 10;
    } else if (xPos < 0) {
      xPos = 10;
    }

    if (yPos + tooltipHeight > viewportHeight) {
      yPos = viewportHeight - tooltipHeight - 10;
    } else if (yPos < 0) {
      yPos = 10;
    }

    // Update final position
    chart.tooltip.style("left", `${xPos}px`).style("top", `${yPos}px`);

    // Highlight the point
    d3.select(this).transition().duration(200).attr("r", 8);
  }

  function hideTooltip() {
    chart.tooltip.style("display", "none");
    // Reset point size
    d3.select(this).transition().duration(200).attr("r", 5);
  }

  // Function to zoom to a specific segment
  function zoomToSegment(segmentData) {
    if (!segmentData || segmentData.length === 0) return;

    chart.isZoomed = true;

    // Update scales for zoomed view
    chart.xScale.domain(d3.extent(segmentData, (d) => d.Timestamp));
    chart.yScale.domain([
      d3.min(segmentData, (d) => d["Libre GL"]) - 10,
      d3.max(segmentData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes with transition
    chart.xAxis
      .transition()
      .duration(250)
      .call(d3.axisBottom(chart.xScale).ticks(5));
    chart.yAxis.transition().duration(250).call(d3.axisLeft(chart.yScale));

    // Update line segments with transition
    chart.lineGroup
      .selectAll(".line-segment")
      .transition()
      .duration(250)
      .attr("d", (d) => {
        return d3
          .line()
          .x((d) => chart.xScale(d.Timestamp))
          .y((d) => chart.yScale(d["Libre GL"]))(d);
      });

    // Update dots with transition
    chart.pointGroup
      .selectAll(".dot")
      .transition()
      .duration(250)
      .attr("cx", (d) => chart.xScale(d.Timestamp))
      .attr("cy", (d) => chart.yScale(d["Libre GL"]));

    // Add double-click instruction
    chart.svg
      .append("text")
      .attr("class", "zoom-instruction")
      .attr("x", chart.width / 2)
      .attr("y", chart.margin.top + 20)
      .attr("text-anchor", "middle")
      .text("Double-click to reset zoom")
      .style("opacity", 0)
      .transition()
      .duration(500)
      .style("opacity", 1);
  }

  // Function to reset zoom
  function resetZoom() {
    chart.isZoomed = false;

    // Reset scales to original domain
    chart.xScale.domain(d3.extent(chart.originalData, (d) => d.Timestamp));
    chart.yScale.domain([
      d3.min(chart.originalData, (d) => d["Libre GL"]) - 10,
      d3.max(chart.originalData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes with transition
    chart.xAxis
      .transition()
      .duration(250)
      .call(d3.axisBottom(chart.xScale).ticks(5));
    chart.yAxis.transition().duration(250).call(d3.axisLeft(chart.yScale));

    // Update line segments with transition
    chart.lineGroup
      .selectAll(".line-segment")
      .transition()
      .duration(250)
      .attr("d", (d) => {
        return d3
          .line()
          .x((d) => chart.xScale(d.Timestamp))
          .y((d) => chart.yScale(d["Libre GL"]))(d);
      });

    // Update dots with transition
    chart.pointGroup
      .selectAll(".dot")
      .transition()
      .duration(250)
      .attr("cx", (d) => chart.xScale(d.Timestamp))
      .attr("cy", (d) => chart.yScale(d["Libre GL"]));

    // Remove zoom instruction
    chart.svg.selectAll(".zoom-instruction").remove();
  }

  // Initialize chart
  initializeChart();
});
